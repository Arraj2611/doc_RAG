// User types
export interface UserType {
  id: number;
  username: string;
  name?: string;
  displayName: string | null;
  email: string | null;
  image?: string;
  plan: string | null;
  preferences: unknown;
  createdAt: Date | null;
}

// Document types
export interface DocumentType {
  id: string;
  name: string;
  size: string | number;
  pages: string | number;
  type: string;
  uploadedAt: string;
  lastOpened: string;
  categories: string[];
  tags: TagType[];
  content?: string;
  thumbnail?: string;
  summary?: string;
  metadata?: {
    author?: string;
    createdDate?: string;
    keywords?: string[];
    [key: string]: any;
  };
}

export interface DocumentUploadOptions {
  generateSummary?: boolean;
  extractMetadata?: boolean;
  categories?: string[];
  tags?: string[];
}

export interface TagType {
  id: string;
  name: string;
  color: string;
}

export interface CategoryType {
  id: string;
  name: string;
}

// Chat types
export interface MessageType {
  id: string;
  sender: "user" | "ai";
  content: string;
  timestamp: string;
  citations?: CitationType[];
  isLoading?: boolean;
  error?: boolean | string;
}

export interface CitationType {
  text: string;
  page: string;
}

// Add this interface
export interface ChatSessionSummary {
  id: string;          // Unique identifier for the session
  title?: string;       // Optional title (maybe first user message?)
  timestamp: string;   // Timestamp of the last message or session start
  documentName?: string; // Associated document name, if any
  messages?: MessageType[]; // Optional: Include messages if readily available, or fetch on demand
}

// Saved Insight Type
export interface SavedInsight {
  id: string;
  documentId: string; // ID of the document it belongs to
  documentName: string; // Name of the document it belongs to (Fixes the linter error)
  text: string; // The actual saved text/insight
  pageNumber: number | string; // Page number where the insight was found
  timestamp: string; // When the insight was saved
  // Add other relevant fields if needed, e.g., tags, comments
}
