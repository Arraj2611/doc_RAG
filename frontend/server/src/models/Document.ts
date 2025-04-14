import mongoose, { Schema, Document as MongoDocument } from 'mongoose';

export interface IDocument extends MongoDocument {
    userId: mongoose.Types.ObjectId;
    name: string;
    size: number;
    pages: number;
    type: string;
    uploadedAt: Date;
    lastOpened: Date;
    categories: string[];
    tags: Array<{
        id: string;
        name: string;
        color: string;
    }>;
    content?: string;
    thumbnail?: string;
    summary?: string;
    metadata?: {
        author?: string;
        createdDate?: Date;
        keywords?: string[];
        [key: string]: any;
    };
    status: 'processing' | 'ready' | 'error';
    error?: string;
}

const DocumentSchema = new Schema<IDocument>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    pages: { type: Number, default: 0 },
    type: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    lastOpened: { type: Date, default: Date.now },
    categories: [{ type: String }],
    tags: [{
        id: { type: String, required: true },
        name: { type: String, required: true },
        color: { type: String, required: true }
    }],
    content: { type: String },
    thumbnail: { type: String },
    summary: { type: String },
    metadata: {
        author: String,
        createdDate: Date,
        keywords: [String],
    },
    status: {
        type: String,
        enum: ['processing', 'ready', 'error'],
        default: 'processing'
    },
    error: { type: String }
}, {
    timestamps: true
});

// Add text index for search functionality
DocumentSchema.index({
    name: 'text',
    content: 'text',
    summary: 'text',
    'metadata.keywords': 'text'
});

export const DocumentModel = mongoose.model<IDocument>('Document', DocumentSchema); 