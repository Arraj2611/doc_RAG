import mongoose, { Document, Schema } from 'mongoose';
import { DocumentMetadata } from '@shared/schema';

// Interface for DocumentMetadata Document
export interface DocumentMetadataDocument extends Omit<DocumentMetadata, 'id' | 'documentId'>, Document {
  // We replace 'id' with MongoDB's '_id'
  // Replace documentId with a reference to the Document model
  documentId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Schema for DocumentMetadata
const documentMetadataSchema = new Schema<DocumentMetadataDocument>(
  {
    documentId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Document',
      required: true,
      index: true
    },
    title: { 
      type: String,
      default: null 
    },
    author: { 
      type: String,
      default: null 
    },
    creationDate: { 
      type: Date,
      default: null 
    },
    lastModifiedDate: { 
      type: Date,
      default: null 
    },
    keywords: { 
      type: [String],
      default: [] 
    },
    subject: { 
      type: String,
      default: null 
    },
    summary: { 
      type: String,
      default: null 
    }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
    // Convert MongoDB _id to id in JSON responses
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Create and export the DocumentMetadata model
export const DocumentMetadataModel = mongoose.model<DocumentMetadataDocument>('DocumentMetadata', documentMetadataSchema);