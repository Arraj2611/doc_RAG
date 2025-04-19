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