import express, { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log, setupVite, serveStatic } from "./vite";
import mongoose from "mongoose";
import { connectToDatabase } from "./database";

async function main() {
  const app = express();

  app.use(express.json());

  // Connect to MongoDB but don't exit if it fails
  try {
    await connectToDatabase();
    log("MongoDB connection ready", "index");
  } catch (error) {
    log(`Failed to connect to MongoDB: ${error}`, "index");
    log("Continuing with in-memory fallback...", "index");
    // Don't exit, we'll use in-memory storage as fallback
  }

  const server = await registerRoutes(app);

  // Setup Vite for development
  if (process.env.NODE_ENV !== "production") {
    log("Setting up Vite development server", "index");
    await setupVite(app, server);
  } else {
    log("Serving static files in production mode", "index");
    serveStatic(app);
  }

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = err.statusCode || 500;
    log(`Error: ${err.message}`, "index");
    res.status(statusCode).json({
      message: err.message,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    });
  });

  // Handle 404 errors
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ message: "Resource not found" });
  });

  // Start the server
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    log(`serving on port ${PORT}`, "express");
  });

  // Graceful shutdown
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);

  function gracefulShutdown() {
    log("Shutting down gracefully...", "index");
    server.close(async () => {
      try {
        // Only try to close MongoDB if we have a connection
        if (mongoose.connection.readyState !== 0) { // 0 = disconnected
          await mongoose.connection.close();
          log("MongoDB connection closed", "index");
        }
        process.exit(0);
      } catch (error) {
        log(`Error during shutdown: ${error}`, "index");
        process.exit(1);
      }
    });
  }
}

main().catch((error) => {
  log(`Server startup error: ${error}`, "index");
  log("Application may still function with reduced capabilities.", "index");
  // Don't exit, we might still be able to run with limited functionality
});