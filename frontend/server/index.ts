import express, { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log, setupVite, serveStatic } from "./vite";
import mongoose from "mongoose";
import { connectToDatabase } from "./database";
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import http from 'http';
import { URL } from 'url';
import axios from 'axios';

async function main() {
  const app = express();

  app.use(express.json());

  // Connect to MongoDB
  try {
    await connectToDatabase();
    log("MongoDB connection ready", "index");
  } catch (error) {
    log(`Failed to connect to MongoDB: ${error}`, "index");
    log("Continuing with in-memory fallback...", "index");
    // Don't exit, we'll use in-memory storage as fallback
  }

  // --- Register Express API Routes (Auth) FIRST ---
  // These routes (e.g., /api/login, /api/user) will be handled before the proxy.
  const server = await registerRoutes(app);
  log("Express routes (Auth) registered.", "index");
  // --- End Express API Routes ---

  // --- Simple Request Logger for /api BEFORE proxy ---
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    log(`[req-logger] Incoming API request: ${req.method} ${req.originalUrl}`, 'api-request');
    next(); // Continue to the proxy middleware
  });

  // --- Setup chat stream proxy endpoint BEFORE the general proxy ---
  app.post('/api/chat-stream-fastapi', async (req: Request, res: Response) => {
    try {
      const fastApiUrl = 'http://localhost:8000';
      log(`Proxying chat stream request to ${fastApiUrl}/api/chat/stream`, 'chat-stream');

      const response = await axios.post(`${fastApiUrl}/api/chat/stream`, req.body, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || ''
        },
        responseType: 'stream'
      });

      // Set headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Pipe the response stream
      response.data.pipe(res);

      // Handle errors
      response.data.on('error', (err) => {
        log(`Stream error: ${err.message}`, 'chat-stream');
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error' });
        }
      });
    } catch (error) {
      log(`Error proxying chat stream: ${error.message}`, 'chat-stream');
      if (!res.headersSent) {
        res.status(error.response?.status || 500).json({
          error: 'Error proxying chat stream',
          details: error.response?.data || error.message
        });
      }
    }
  });
  log("Chat stream proxy endpoint setup.", "index");

  // --- Setup document endpoints ---
  app.get('/api/documents', async (req: Request, res: Response) => {
    try {
      const fastApiUrl = 'http://localhost:8000';
      log(`Proxying documents request to ${fastApiUrl}/api/documents`, 'documents');

      const response = await axios.get(`${fastApiUrl}/api/documents`, {
        headers: {
          'Authorization': req.headers.authorization || ''
        }
      });

      log(`Documents response: ${JSON.stringify(response.data)}`, 'documents');
      res.json(response.data);
    } catch (error) {
      log(`Error proxying documents request: ${error.message}`, 'documents');
      // If the backend returns a 404, return an empty array instead of an error
      if (error.response?.status === 404) {
        log('Backend returned 404, returning empty array', 'documents');
        return res.json([]);
      }
      res.status(error.response?.status || 500).json({
        error: 'Error fetching documents',
        details: error.response?.data || error.message
      });
    }
  });

  // --- Setup metadata endpoints ---
  app.get('/api/metadata/tags', async (req: Request, res: Response) => {
    try {
      const fastApiUrl = 'http://localhost:8000';
      log(`Proxying tags request to ${fastApiUrl}/api/metadata/tags`, 'metadata');

      const response = await axios.get(`${fastApiUrl}/api/metadata/tags`, {
        headers: {
          'Authorization': req.headers.authorization || ''
        }
      });

      res.json(response.data);
    } catch (error) {
      log(`Error proxying tags request: ${error.message}`, 'metadata');
      // If the backend returns a 404, return an empty array instead of an error
      if (error.response?.status === 404) {
        log('Backend returned 404 for tags, returning default tags', 'metadata');
        return res.json([
          { "id": "1", "name": "Important", "color": "#ff0000" },
          { "id": "2", "name": "Review", "color": "#00ff00" },
          { "id": "3", "name": "Archive", "color": "#0000ff" },
          { "id": "4", "name": "Legal", "color": "#ffff00" },
          { "id": "5", "name": "Research", "color": "#800080" }
        ]);
      }
      res.status(error.response?.status || 500).json({
        error: 'Error fetching tags',
        details: error.response?.data || error.message
      });
    }
  });

  app.get('/api/metadata/categories', async (req: Request, res: Response) => {
    try {
      const fastApiUrl = 'http://localhost:8000';
      log(`Proxying categories request to ${fastApiUrl}/api/metadata/categories`, 'metadata');

      const response = await axios.get(`${fastApiUrl}/api/metadata/categories`, {
        headers: {
          'Authorization': req.headers.authorization || ''
        }
      });

      res.json(response.data);
    } catch (error) {
      log(`Error proxying categories request: ${error.message}`, 'metadata');
      // If the backend returns a 404, return an empty array instead of an error
      if (error.response?.status === 404) {
        log('Backend returned 404 for categories, returning default categories', 'metadata');
        return res.json([
          { "id": "1", "name": "Reports" },
          { "id": "2", "name": "Contracts" },
          { "id": "3", "name": "Presentations" },
          { "id": "4", "name": "Research Papers" },
          { "id": "5", "name": "Manuals" }
        ]);
      }
      res.status(error.response?.status || 500).json({
        error: 'Error fetching categories',
        details: error.response?.data || error.message
      });
    }
  });

  // --- Setup chat sessions endpoint ---
  app.get('/api/chat/sessions', async (req: Request, res: Response) => {
    try {
      const fastApiUrl = 'http://localhost:8000';
      log(`Proxying chat sessions request to ${fastApiUrl}/api/chat/sessions`, 'chat');

      const response = await axios.get(`${fastApiUrl}/api/chat/sessions`, {
        headers: {
          'Authorization': req.headers.authorization || ''
        }
      });

      res.json(response.data);
    } catch (error) {
      log(`Error proxying chat sessions request: ${error.message}`, 'chat');
      // If the backend returns a 404, return an empty array instead of an error
      if (error.response?.status === 404) {
        log('Backend returned 404 for chat sessions, returning empty array', 'chat');
        return res.json([]);
      }
      res.status(error.response?.status || 500).json({
        error: 'Error fetching chat sessions',
        details: error.response?.data || error.message
      });
    }
  });

  // --- Configure API Proxy SECOND (Simplified) ---
  const proxyOptions: Options = {
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
    // Explicitly KEEP the /api prefix (Default, but being explicit)
    pathRewrite: {
      [`^/api`]: '/api', // /api/documents -> /api/documents
    },
    // Skip proxy for endpoints we've already defined
    filter: (pathname) => {
      // Skip our custom endpoints
      if (pathname === '/api/chat-stream-fastapi' ||
        pathname === '/api/documents' ||
        pathname === '/api/metadata/tags' ||
        pathname === '/api/metadata/categories' ||
        pathname === '/api/chat/sessions') {
        return false;
      }
      return true;
    }
  };
  app.use('/api', createProxyMiddleware(proxyOptions));
  log("API proxy middleware configured with custom filters", "index");
  log("API proxy middleware configured (simplified) for remaining /api requests to target port 8000", "index");
  // --- End Proxy Configuration ---

  // Setup Vite for development (after proxy and auth routes)
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