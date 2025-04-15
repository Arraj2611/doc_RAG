import bcrypt from 'bcryptjs'; // Use import
import jwt from 'jsonwebtoken'; // Use import
import User from '../models/User.js'; // Use import and add .js extension
import 'dotenv/config'; // Use import for dotenv config

// Register user
export const registerUser = async (req, res) => { // Use export
  const { name, email, password } = req.body; // <<< Removed age
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" }); // Use .json()
    }

    // Generate salt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      // age is removed
    });

    // Save user
    const savedUser = await newUser.save();

    // Respond (excluding password)
    res.status(201).json({ // Use .json()
      message: "User Registered",
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
      },
    });
  } catch (err) {
    console.error('Registration Error:', err); // Log the error
    res.status(500).json({ message: "Server error during registration" }); // Use .json()
  }
};

// Login user
export const loginUser = async (req, res) => { // Use export
  const { email, password } = req.body;
  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" }); // 401 Unauthorized
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" }); // 401 Unauthorized
    }

    // Generate JWT
    const payload = {
      id: user._id, // <<< Use id for middleware
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "1h" } // Consider a longer expiration? e.g., '7d'
    );

    // Respond with token and user details (excluding password)
    res.json({ // Use .json()
      message: "Login Success",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('Login Error:', err); // Log the error
    res.status(500).json({ message: "Server error during login" }); // Use .json()
  }
};
