// User types
export interface UserType {
  id: number;
  username: string;
  displayName: string | null;
  email: string | null;
  plan: string | null;
  preferences: unknown;
  createdAt: Date | null;
}

// --- Added Auth Types ---
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegistrationData extends LoginCredentials {
  email?: string | null;
  displayName?: string | null;
}
// --- End Added Auth Types ---

// Document types
export interface DocumentType {
  id: string;
  name: string;
  size: string;
  pages: number;
  type: string;
  uploadedAt: string;
  categories?: string[];
  tags?: Array<{ name: string; color: string }>;
  thumbnail?: string | null;
  processed: boolean;
}

export interface DocumentUploadOptions {
  categories?: string[];
  tags?: Array<{ name: string; color: string }>;
  sessionId?: string;
}

export interface TagType {
  id: string;
  name: string;
  color: string;
}

export interface CategoryType {
  id: string;
  name: string;
  icon: string;
}

// --- Added Process/Chat Types ---
export interface ProcessResponse {
  message: string;
  processed_count?: number; // Optional based on backend response
  error?: string;
}

export interface ChatStreamRequest {
  question: string;
  session_id?: string | null; // Can be session ID for general chat
  tenant_id?: string | null;  // Can be doc-specific tenant ID
  // Add any other fields your backend expects
}
// --- End Added Process/Chat Types ---

// Chat types
export interface MessageType {
  id: string;
  sender: "user" | "ai";
  content: string;
  timestamp: string;
  citations?: CitationType[];
}

export interface CitationType {
  text: string;
  page: string;
  documentId?: string;
}
