import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  email: text("email"),
  plan: text("plan").default("free"),
  preferences: jsonb("preferences"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Documents table
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  fileSize: integer("file_size").notNull(),
  pageCount: integer("page_count"),
  fileType: text("file_type").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  lastOpenedAt: timestamp("last_opened_at"),
  status: text("status").default("processing"), // processing, ready, error
  thumbnail: text("thumbnail"),
  tags: jsonb("tags"),
  categories: jsonb("categories"),
});

// Document content storage
export const documentContent = pgTable("document_content", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => documents.id).notNull(),
  content: text("content").notNull(), // Could be chunked text or vector embeddings
  pageNumber: integer("page_number"),
  chunkId: text("chunk_id"),
});

// Document metadata
export const documentMetadata = pgTable("document_metadata", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => documents.id).notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
});

// Chat messages
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => documents.id),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  sender: text("sender").notNull(), // "user" or "ai"
  createdAt: timestamp("created_at").defaultNow(),
  citations: jsonb("citations"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
  email: true,
  plan: true,
  preferences: true,
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  userId: true,
  name: true,
  fileSize: true,
  pageCount: true,
  fileType: true,
  status: true,
  thumbnail: true,
  tags: true,
  categories: true,
});

export const insertDocumentContentSchema = createInsertSchema(documentContent).pick({
  documentId: true,
  content: true,
  pageNumber: true,
  chunkId: true,
});

export const insertDocumentMetadataSchema = createInsertSchema(documentMetadata).pick({
  documentId: true,
  key: true,
  value: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  documentId: true,
  userId: true,
  content: true,
  sender: true,
  citations: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertDocumentContent = z.infer<typeof insertDocumentContentSchema>;
export type DocumentContent = typeof documentContent.$inferSelect;

export type InsertDocumentMetadata = z.infer<typeof insertDocumentMetadataSchema>;
export type DocumentMetadata = typeof documentMetadata.$inferSelect;

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
