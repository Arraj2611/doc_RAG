import type { Express, Request } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import MongoStore from "connect-mongo";
import { storage } from "./storage";
import { log } from "./vite";
import bcrypt from "bcryptjs";
import { User as SharedUser, InsertUser as SharedInsertUser } from "@shared/schema";
import jwt from 'jsonwebtoken';

const SESSION_SECRET = process.env.SESSION_SECRET || "default_secret_please_change";
const FASTAPI_SECRET_KEY = process.env.FASTAPI_SECRET_KEY || "fastapi_secret_needs_change";

// Extend Express Request type to include user, omitting the hashed password field
declare global {
  namespace Express {
    // Use the User type from the shared schema, but omit the actual password hash field
    interface User extends Omit<SharedUser, 'password'> { }
  }
}

export function setupAuth(app: Express) {
  // Passport configuration
  passport.use(
    new LocalStrategy(
      { usernameField: "username", passwordField: "password" },
      async (username, password, done) => {
        try {
          // Fetch user (including the hashed password field named 'password')
          const user = await storage.getUserByUsername(username);
          // Check user exists and has the password field (hash)
          if (!user || !user.password) {
            log(`Login failed: User not found or hash missing - ${username}`, "auth");
            return done(null, false, { message: "Incorrect username or password." });
          }

          // Compare provided password with stored hash (user.password)
          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            log(`Login failed: Incorrect password for user - ${username}`, "auth");
            return done(null, false, { message: "Incorrect username or password." });
          }

          log(`Login successful for user: ${username}`, "auth");
          // User authenticated, remove actual password hash before passing to serializeUser
          const { password: _, ...userWithoutPassword } = user;

          // Generate JWT for FastAPI
          const payload = { userId: user.id, username: user.username };
          const accessToken = jwt.sign(payload, FASTAPI_SECRET_KEY, { expiresIn: '1h' });

          // Include token with user data passed to serializeUser/done
          return done(null, { ...userWithoutPassword, accessToken } as Express.User & { accessToken: string });
        } catch (err) {
          log(`Error during authentication: ${err}`, "auth");
          return done(err);
        }
      },
    ),
  );

  // Store only user ID in session, token handled separately client-side
  passport.serializeUser((user: Express.User & { accessToken?: string }, done) => {
    // We only need to serialize the core user ID for the session management
    done(null, user.id);
  });

  // Retrieve user from session using ID
  passport.deserializeUser(async (id: number, done) => { // ID is likely number based on serial type
    try {
      // Fetch user by ID using the correct storage function
      const user = await storage.getUser(id);
      if (user) {
        // Remove password hash before attaching to req.user
        const { password: _, ...userForSession } = user;
        // Token is not stored in the session, it's managed client-side
        done(null, userForSession as Express.User);
      } else {
        done(null, false); // User not found
      }
    } catch (err) {
      done(err);
    }
  });

  // Session configuration
  const mongoUrl = process.env.DATABASE_URL || "mongodb://localhost:27017/doc_rag_db";
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: mongoUrl,
        collectionName: "sessions",
        ttl: 14 * 24 * 60 * 60, // 14 days
      }),
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
        sameSite: "lax",
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // --- Authentication Routes --- 

  // Registration route
  app.post("/auth/register", async (req, res, next) => {
    // Use SharedInsertUser type for validation if possible, otherwise rely on body parsing
    const { username, password, email, displayName } = req.body as Partial<SharedInsertUser>;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }
    try {
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        log(`Registration failed: Username already exists - ${username}`, "auth");
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user data, passing the hash under the 'password' field
      const newUser = await storage.createUser({
        username,
        password: hashedPassword, // Pass hash as 'password'
        email: email || undefined,
        displayName: displayName || undefined,
        // Ensure createUser expects this structure or adapt as needed
      } as SharedInsertUser); // Cast might be needed depending on createUser signature

      // Prepare user object for login (remove hash)
      const { password: _hash, ...userToLogin } = newUser;

      // Generate JWT for FastAPI
      const payload = { userId: newUser.id, username: newUser.username };
      const accessToken = jwt.sign(payload, FASTAPI_SECRET_KEY, { expiresIn: '1h' });

      log(`User registered successfully: ${username}`, "auth");
      req.login({ ...userToLogin, accessToken } as Express.User & { accessToken: string }, (err) => {
        if (err) {
          log(`Error logging in user after registration: ${err}`, "auth");
          return next(err);
        }
        // Send back user data AND the access token
        return res.status(201).json({ ...userToLogin, accessToken });
      });
    } catch (error) {
      log(`Error during registration: ${error}`, "auth");
      next(error);
    }
  });

  // Login route
  app.post("/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: Express.User & { accessToken: string } | false, info: { message: string }) => {
      if (err) {
        log(`Login error (passport.authenticate): ${err}`, "auth");
        return next(err);
      }
      if (!user) {
        log(`Login failed (passport.authenticate): ${info.message}`, "auth");
        return res.status(401).json({ message: info.message || "Incorrect username or password." });
      }
      // User contains the accessToken generated in the strategy's done callback
      req.login(user, { session: false }, (loginErr) => { // Use session: false if token is primary auth
        if (loginErr) {
          log(`Login error (req.login): ${loginErr}`, "auth");
          return next(loginErr);
        }
        log(`User logged in via /auth/login: ${user.username}`, "auth");
        // Send back user data AND the access token
        return res.status(200).json({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          plan: user.plan,
          preferences: user.preferences,
          createdAt: user.createdAt,
          accessToken: user.accessToken // Include the token in the response
        });
      });
    })(req, res, next); // Manually invoke passport.authenticate middleware
  });

  // Logout route
  app.post("/auth/logout", (req, res, next) => {
    const username = req.user?.username;
    req.logout((err) => {
      if (err) {
        log(`Error during logout for user ${username}: ${err}`, "auth");
        return next(err);
      }
      log(`User logged out: ${username}`, "auth");
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          log(`Error destroying session during logout for user ${username}: ${destroyErr}`, "auth");
        }
        // Also clear any client-side token storage if possible (though done client-side)
        res.status(200).json({ message: "Logged out successfully" });
      });
    });
  });

  // Get current user route
  app.get("/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      log(`Current user requested: ${req.user?.username}`, "auth");
      // Don't send the token here, client should already have it stored
      res.json(req.user);
    } else {
      log("Current user requested but not authenticated", "auth");
      res.status(401).json({ message: "Not authenticated" });
    }
  });
}