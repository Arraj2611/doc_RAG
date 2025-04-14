import { 
  User, 
  InsertUser, 
  Document, 
  InsertDocument,
  DocumentContent,
  InsertDocumentContent,
  DocumentMetadata,
  InsertDocumentMetadata,
  ChatMessage,
  InsertChatMessage 
} from '@shared/schema';
import session from 'express-session';
import { log } from './vite';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import { 
  UserModel, 
  DocumentModel, 
  DocumentContentModel, 
  DocumentMetadataModel, 
  ChatMessageModel 
} from './models';
import { inMemoryStorage } from './in-memory-storage';

// Storage interface for the application
export interface IStorage {
  // User methods
  getUser(id: number | string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Document methods
  getAllDocuments(): Promise<Document[]>;
  getUserDocuments(userId: number | string): Promise<Document[]>;
  getDocument(id: number | string): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  deleteDocument(id: number | string): Promise<void>;
  
  // Document content methods
  getDocumentContent(documentId: number | string): Promise<DocumentContent | undefined>;
  createDocumentContent(content: InsertDocumentContent): Promise<DocumentContent>;
  
  // Document metadata methods
  getDocumentMetadata(documentId: number | string): Promise<DocumentMetadata | undefined>;
  createDocumentMetadata(metadata: InsertDocumentMetadata): Promise<DocumentMetadata>;
  
  // Chat message methods
  getDocumentMessages(documentId: number | string): Promise<ChatMessage[]>;
  getUserMessages(userId: number | string): Promise<ChatMessage[]>;
  getSessionMessages(sessionId: string): Promise<ChatMessage[]>;
  createMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  // Session store
  sessionStore: session.Store;
}

// Hybrid storage implementation that falls back to in-memory storage when MongoDB is unavailable
export class MongoDBStorage implements IStorage {
  sessionStore: session.Store;
  private useFallback: boolean = false;
  
  constructor() {
    try {
      // Initialize MongoDB session store
      // Create MongoDB session store using direct connection string
      this.sessionStore = MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/documind',
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60, // 14 days
        autoRemove: 'native'
      });
      
      log('MongoDB session store initialized', 'storage');
    } catch (error) {
      // Fallback to memory store if MongoDB connection fails
      log(`Error initializing MongoDB session store: ${error}. Using memory store as fallback.`, 'storage');
      this.sessionStore = inMemoryStorage.sessionStore;
      this.useFallback = true;
    }
  }
  
  // User methods
  async getUser(id: number | string): Promise<User | undefined> {
    try {
      const user = await UserModel.findById(id).lean();
      return user ? this.convertToUser(user) : undefined;
    } catch (error) {
      log(`Error getting user: ${error}`, 'storage');
      return undefined;
    }
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const user = await UserModel.findOne({ username }).lean();
      return user ? this.convertToUser(user) : undefined;
    } catch (error) {
      log(`Error getting user by username: ${error}`, 'storage');
      return undefined;
    }
  }
  
  async createUser(user: InsertUser): Promise<User> {
    try {
      const newUser = await UserModel.create(user);
      return this.convertToUser(newUser.toObject());
    } catch (error) {
      log(`Error creating user: ${error}`, 'storage');
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }
  
  // Document methods
  async getAllDocuments(): Promise<Document[]> {
    try {
      const documents = await DocumentModel.find().lean();
      return documents.map(doc => this.convertToDocument(doc));
    } catch (error) {
      log(`Error getting all documents: ${error}`, 'storage');
      return [];
    }
  }
  
  async getUserDocuments(userId: number | string): Promise<Document[]> {
    try {
      const documents = await DocumentModel.find({ userId }).lean();
      return documents.map(doc => this.convertToDocument(doc));
    } catch (error) {
      log(`Error getting user documents: ${error}`, 'storage');
      return [];
    }
  }
  
  async getDocument(id: number | string): Promise<Document | undefined> {
    try {
      const document = await DocumentModel.findById(id).lean();
      return document ? this.convertToDocument(document) : undefined;
    } catch (error) {
      log(`Error getting document: ${error}`, 'storage');
      return undefined;
    }
  }
  
  async createDocument(doc: InsertDocument): Promise<Document> {
    try {
      const newDocument = await DocumentModel.create(doc);
      return this.convertToDocument(newDocument.toObject());
    } catch (error) {
      log(`Error creating document: ${error}`, 'storage');
      throw new Error(`Failed to create document: ${error.message}`);
    }
  }
  
  async deleteDocument(id: number | string): Promise<void> {
    try {
      // Delete the document and all related content and metadata
      await Promise.all([
        DocumentModel.findByIdAndDelete(id),
        DocumentContentModel.deleteMany({ documentId: id }),
        DocumentMetadataModel.deleteMany({ documentId: id }),
        ChatMessageModel.deleteMany({ documentId: id })
      ]);
      
      log(`Document ${id} and all related data deleted`, 'storage');
    } catch (error) {
      log(`Error deleting document: ${error}`, 'storage');
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }
  
  // Document content methods
  async getDocumentContent(documentId: number | string): Promise<DocumentContent | undefined> {
    try {
      const content = await DocumentContentModel.findOne({ documentId }).lean();
      return content ? this.convertToDocumentContent(content) : undefined;
    } catch (error) {
      log(`Error getting document content: ${error}`, 'storage');
      return undefined;
    }
  }
  
  async createDocumentContent(content: InsertDocumentContent): Promise<DocumentContent> {
    try {
      const newContent = await DocumentContentModel.create(content);
      return this.convertToDocumentContent(newContent.toObject());
    } catch (error) {
      log(`Error creating document content: ${error}`, 'storage');
      throw new Error(`Failed to create document content: ${error.message}`);
    }
  }
  
  // Document metadata methods
  async getDocumentMetadata(documentId: number | string): Promise<DocumentMetadata | undefined> {
    try {
      const metadata = await DocumentMetadataModel.findOne({ documentId }).lean();
      return metadata ? this.convertToDocumentMetadata(metadata) : undefined;
    } catch (error) {
      log(`Error getting document metadata: ${error}`, 'storage');
      return undefined;
    }
  }
  
  async createDocumentMetadata(metadata: InsertDocumentMetadata): Promise<DocumentMetadata> {
    try {
      const newMetadata = await DocumentMetadataModel.create(metadata);
      return this.convertToDocumentMetadata(newMetadata.toObject());
    } catch (error) {
      log(`Error creating document metadata: ${error}`, 'storage');
      throw new Error(`Failed to create document metadata: ${error.message}`);
    }
  }
  
  // Chat message methods
  async getDocumentMessages(documentId: number | string): Promise<ChatMessage[]> {
    try {
      const messages = await ChatMessageModel.find({ documentId }).sort({ createdAt: 1 }).lean();
      return messages.map(msg => this.convertToChatMessage(msg));
    } catch (error) {
      log(`Error getting document messages: ${error}`, 'storage');
      return [];
    }
  }
  
  async getUserMessages(userId: number | string): Promise<ChatMessage[]> {
    try {
      const messages = await ChatMessageModel.find({ userId }).sort({ createdAt: 1 }).lean();
      return messages.map(msg => this.convertToChatMessage(msg));
    } catch (error) {
      log(`Error getting user messages: ${error}`, 'storage');
      return [];
    }
  }
  
  async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
      const messages = await ChatMessageModel.find({ sessionId }).sort({ createdAt: 1 }).lean();
      return messages.map(msg => this.convertToChatMessage(msg));
    } catch (error) {
      log(`Error getting session messages: ${error}`, 'storage');
      return [];
    }
  }
  
  async createMessage(message: InsertChatMessage): Promise<ChatMessage> {
    try {
      const newMessage = await ChatMessageModel.create(message);
      return this.convertToChatMessage(newMessage.toObject());
    } catch (error) {
      log(`Error creating message: ${error}`, 'storage');
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }
  
  // Utility methods to convert MongoDB documents to schema types
  private convertToUser(user: any): User {
    return {
      id: user._id ? user._id.toString() : user.id,
      username: user.username,
      password: user.password,
      displayName: user.displayName,
      email: user.email,
      profilePic: user.profilePic,
      role: user.role
    };
  }
  
  private convertToDocument(doc: any): Document {
    return {
      id: doc._id ? doc._id.toString() : doc.id,
      name: doc.name,
      status: doc.status,
      userId: doc.userId ? doc.userId.toString() : null,
      fileSize: doc.fileSize,
      pageCount: doc.pageCount,
      fileType: doc.fileType,
      uploadedAt: doc.uploadedAt,
      lastOpenedAt: doc.lastOpenedAt,
      thumbnail: doc.thumbnail,
      tags: doc.tags,
      categories: doc.categories
    };
  }
  
  private convertToDocumentContent(content: any): DocumentContent {
    return {
      id: content._id ? content._id.toString() : content.id,
      documentId: content.documentId ? content.documentId.toString() : null,
      content: content.content,
      pageNumber: content.pageNumber,
      processingStatus: content.processingStatus
    };
  }
  
  private convertToDocumentMetadata(metadata: any): DocumentMetadata {
    return {
      id: metadata._id ? metadata._id.toString() : metadata.id,
      documentId: metadata.documentId ? metadata.documentId.toString() : null,
      title: metadata.title,
      author: metadata.author,
      creationDate: metadata.creationDate,
      lastModifiedDate: metadata.lastModifiedDate,
      keywords: metadata.keywords,
      subject: metadata.subject,
      summary: metadata.summary
    };
  }
  
  private convertToChatMessage(message: any): ChatMessage {
    return {
      id: message._id ? message._id.toString() : message.id,
      content: message.content,
      sender: message.sender,
      userId: message.userId ? message.userId.toString() : null,
      documentId: message.documentId ? message.documentId.toString() : null,
      createdAt: message.createdAt,
      citations: message.citations || []
    };
  }
}

export const storage = new MongoDBStorage();