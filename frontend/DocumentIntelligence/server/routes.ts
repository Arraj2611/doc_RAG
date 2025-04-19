import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { log } from "./vite";
import { Document, InsertDocument, InsertDocumentContent, InsertDocumentMetadata, InsertChatMessage } from "@shared/schema";
import mongoose from "mongoose";
import { connectToDatabase } from "./database";

// Document routes - protected by authentication
export async function registerRoutes(app: Express): Promise<Server> {
  // Connect to MongoDB
  await connectToDatabase();

  // Setup auth routes - this handles /api/register, /api/login, /api/logout, /api/user
  setupAuth(app);

  // Middleware to ensure user is authenticated
  const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Authentication required" });
  };

  // Documents API
  
  // Get all documents for the current user
  app.get("/api/documents", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      const documents = await storage.getUserDocuments(userId);
      res.json(documents);
    } catch (error) {
      log(`Error fetching documents: ${error}`, "routes");
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Get a specific document
  app.get("/api/documents/:id", ensureAuthenticated, async (req, res) => {
    try {
      const documentId = req.params.id;
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Ensure the user owns this document
      if (document.userId !== req.user?.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(document);
    } catch (error) {
      log(`Error fetching document: ${error}`, "routes");
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  // Create a new document
  app.post("/api/documents", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      
      const documentData: InsertDocument = {
        ...req.body,
        userId,
        uploadedAt: new Date(),
      };
      
      const document = await storage.createDocument(documentData);
      res.status(201).json(document);
    } catch (error) {
      log(`Error creating document: ${error}`, "routes");
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  // Delete a document
  app.delete("/api/documents/:id", ensureAuthenticated, async (req, res) => {
    try {
      const documentId = req.params.id;
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Ensure the user owns this document
      if (document.userId !== req.user?.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteDocument(documentId);
      res.status(200).json({ message: "Document deleted successfully" });
    } catch (error) {
      log(`Error deleting document: ${error}`, "routes");
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Document content API
  
  // Get content for a document
  app.get("/api/documents/:id/content", ensureAuthenticated, async (req, res) => {
    try {
      const documentId = req.params.id;
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Ensure the user owns this document
      if (document.userId !== req.user?.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const content = await storage.getDocumentContent(documentId);
      
      if (!content) {
        return res.status(404).json({ message: "Document content not found" });
      }
      
      res.json(content);
    } catch (error) {
      log(`Error fetching document content: ${error}`, "routes");
      res.status(500).json({ message: "Failed to fetch document content" });
    }
  });

  // Add content to a document
  app.post("/api/documents/:id/content", ensureAuthenticated, async (req, res) => {
    try {
      const documentId = req.params.id;
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Ensure the user owns this document
      if (document.userId !== req.user?.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const contentData: InsertDocumentContent = {
        documentId,
        content: req.body.content,
        pageNumber: req.body.pageNumber,
        processingStatus: req.body.processingStatus || "pending"
      };
      
      const content = await storage.createDocumentContent(contentData);
      res.status(201).json(content);
    } catch (error) {
      log(`Error adding document content: ${error}`, "routes");
      res.status(500).json({ message: "Failed to add document content" });
    }
  });

  // Document metadata API
  
  // Get metadata for a document
  app.get("/api/documents/:id/metadata", ensureAuthenticated, async (req, res) => {
    try {
      const documentId = req.params.id;
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Ensure the user owns this document
      if (document.userId !== req.user?.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const metadata = await storage.getDocumentMetadata(documentId);
      
      if (!metadata) {
        return res.status(404).json({ message: "Document metadata not found" });
      }
      
      res.json(metadata);
    } catch (error) {
      log(`Error fetching document metadata: ${error}`, "routes");
      res.status(500).json({ message: "Failed to fetch document metadata" });
    }
  });

  // Add metadata to a document
  app.post("/api/documents/:id/metadata", ensureAuthenticated, async (req, res) => {
    try {
      const documentId = req.params.id;
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Ensure the user owns this document
      if (document.userId !== req.user?.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const metadataData: InsertDocumentMetadata = {
        documentId,
        ...req.body
      };
      
      const metadata = await storage.createDocumentMetadata(metadataData);
      res.status(201).json(metadata);
    } catch (error) {
      log(`Error adding document metadata: ${error}`, "routes");
      res.status(500).json({ message: "Failed to add document metadata" });
    }
  });

  // Chat messages API
  
  // Get chat messages for a document
  app.get("/api/documents/:id/messages", ensureAuthenticated, async (req, res) => {
    try {
      const documentId = req.params.id;
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Ensure the user owns this document
      if (document.userId !== req.user?.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const messages = await storage.getDocumentMessages(documentId);
      res.json(messages);
    } catch (error) {
      log(`Error fetching document messages: ${error}`, "routes");
      res.status(500).json({ message: "Failed to fetch document messages" });
    }
  });

  // Get chat messages for a session
  app.get("/api/sessions/:sessionId/messages", ensureAuthenticated, async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const messages = await storage.getSessionMessages(sessionId);
      
      // Check if there are any messages in this session
      if (messages.length > 0) {
        // Ensure the user owns these messages
        if (messages[0].userId !== req.user?.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      res.json(messages);
    } catch (error) {
      log(`Error fetching session messages: ${error}`, "routes");
      res.status(500).json({ message: "Failed to fetch session messages" });
    }
  });

  // Add a chat message
  app.post("/api/messages", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      
      // If a documentId is provided, verify the user has access to it
      if (req.body.documentId) {
        const document = await storage.getDocument(req.body.documentId);
        
        if (!document) {
          return res.status(404).json({ message: "Document not found" });
        }
        
        if (document.userId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const messageData: InsertChatMessage = {
        ...req.body,
        userId,
        createdAt: new Date()
      };
      
      const message = await storage.createMessage(messageData);
      res.status(201).json(message);
    } catch (error) {
      log(`Error creating message: ${error}`, "routes");
      res.status(500).json({ message: "Failed to create message" });
    }
  });
  
  // Create an HTTP server for the Express app
  const httpServer = createServer(app);
  
  return httpServer;
}