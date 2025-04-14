import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { log } from "./vite";
import mongoose from "mongoose";
import { connectToDatabase } from "./database";
import axios from "axios";
import { config } from "./config";

export async function registerRoutes(app: Express): Promise<Server> {
  // Connect to MongoDB
  await connectToDatabase();

  // Setup auth routes - this handles /api/register, /api/login, /api/logout, /api/user
  setupAuth(app);

  log("Authentication routes setup.", "routes");

  // We'll move the chat stream proxy endpoint to index.ts

  log("API routes registration complete.", "routes");
  return createServer(app);
}