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
import createMemoryStore from 'memorystore';
import { v4 as uuidv4 } from 'uuid';

// Create a memory store for sessions
const MemoryStore = createMemoryStore(session);

// In-memory storage class for development and fallback
export class InMemoryStorage {
  sessionStore: session.Store;
  private users: User[] = [];
  private documents: Document[] = [];
  private documentContents: DocumentContent[] = [];
  private documentMetadata: DocumentMetadata[] = [];
  private chatMessages: ChatMessage[] = [];
  
  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    
    log('In-memory storage initialized', 'storage');
    
    // Add a default admin user for development
    this.createUser({
      username: 'admin',
      password: '$2a$10$aGmK7EWlV1jWzp85TS4nve2XEYpb1nHUMsTPGwvUj2B2Z.Bw0X5S6', // 'password' hashed
      displayName: 'Admin User',
      email: 'admin@example.com',
      role: 'admin'
    }).catch(err => log(`Error creating default user: ${err}`, 'storage'));
  }
  
  // User methods
  async getUser(id: number | string): Promise<User | undefined> {
    return this.users.find(user => user.id === id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(user => user.username === username);
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = {
      id: uuidv4(),
      ...user,
      createdAt: new Date().toISOString()
    };
    
    this.users.push(newUser);
    log(`Created user: ${newUser.username}`, 'storage');
    return newUser;
  }
  
  // Document methods
  async getAllDocuments(): Promise<Document[]> {
    return [...this.documents];
  }
  
  async getUserDocuments(userId: number | string): Promise<Document[]> {
    return this.documents.filter(doc => doc.userId === userId);
  }
  
  async getDocument(id: number | string): Promise<Document | undefined> {
    return this.documents.find(doc => doc.id === id);
  }
  
  async createDocument(doc: InsertDocument): Promise<Document> {
    const newDocument: Document = {
      id: uuidv4(),
      ...doc,
      uploadedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString()
    };
    
    this.documents.push(newDocument);
    log(`Created document: ${newDocument.name}`, 'storage');
    return newDocument;
  }
  
  async deleteDocument(id: number | string): Promise<void> {
    // Remove document
    this.documents = this.documents.filter(doc => doc.id !== id);
    
    // Remove related content and metadata
    this.documentContents = this.documentContents.filter(content => content.documentId !== id);
    this.documentMetadata = this.documentMetadata.filter(meta => meta.documentId !== id);
    this.chatMessages = this.chatMessages.filter(msg => msg.documentId !== id);
    
    log(`Deleted document: ${id}`, 'storage');
  }
  
  // Document content methods
  async getDocumentContent(documentId: number | string): Promise<DocumentContent | undefined> {
    return this.documentContents.find(content => content.documentId === documentId);
  }
  
  async createDocumentContent(content: InsertDocumentContent): Promise<DocumentContent> {
    const newContent: DocumentContent = {
      id: uuidv4(),
      ...content
    };
    
    this.documentContents.push(newContent);
    log(`Created document content for document: ${newContent.documentId}`, 'storage');
    return newContent;
  }
  
  // Document metadata methods
  async getDocumentMetadata(documentId: number | string): Promise<DocumentMetadata | undefined> {
    return this.documentMetadata.find(meta => meta.documentId === documentId);
  }
  
  async createDocumentMetadata(metadata: InsertDocumentMetadata): Promise<DocumentMetadata> {
    const newMetadata: DocumentMetadata = {
      id: uuidv4(),
      ...metadata
    };
    
    this.documentMetadata.push(newMetadata);
    log(`Created metadata for document: ${newMetadata.documentId}`, 'storage');
    return newMetadata;
  }
  
  // Chat message methods
  async getDocumentMessages(documentId: number | string): Promise<ChatMessage[]> {
    return this.chatMessages
      .filter(msg => msg.documentId === documentId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  
  async getUserMessages(userId: number | string): Promise<ChatMessage[]> {
    return this.chatMessages
      .filter(msg => msg.userId === userId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  
  async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    return this.chatMessages
      .filter(msg => (msg as any).sessionId === sessionId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  
  async createMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const newMessage: ChatMessage = {
      id: uuidv4(),
      ...message,
      createdAt: new Date().toISOString()
    };
    
    this.chatMessages.push(newMessage);
    return newMessage;
  }
}

// Export a singleton instance
export const inMemoryStorage = new InMemoryStorage();