export interface DocumentUploadOptions {
    generateSummary?: boolean;
    extractMetadata?: boolean;
    ocrEnabled?: boolean;
    categories?: string[];
    tags?: Array<{
        id: string;
        name: string;
        color: string;
    }>;
}

export interface User {
    id: number;
    username: string;
    email: string | null;
    displayName: string | null;
    plan: string | null;
    preferences: unknown;
    createdAt: Date | null;
}

export interface Tag {
    id: string;
    name: string;
    color: string;
}

export interface Category {
    id: string;
    name: string;
}

export interface DocumentMetadata {
    author?: string;
    createdDate?: Date;
    keywords?: string[];
    [key: string]: any;
}

// Define DocumentType based on the backend response
export interface DocumentType {
    id: string;
    name: string;
    size: number; // Use number for size
    upload_time: string; // Matches backend ISO string
    status: string;
    doc_type: string;
    page_count: number;
    tenant_id: string;
    // Add optional fields if they might exist or for UI state
    categories?: string[];
    tags?: Tag[];
    thumbnail?: string | null;
    processed?: boolean;
}

// You might also want a type for the User object returned by your auth endpoint
export interface UserData {
    user_id: string;
    // Add other fields returned by decode_jwt/get_current_user in backend
} 