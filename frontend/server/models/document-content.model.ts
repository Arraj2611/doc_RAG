import mongoose, { Document, Schema } from 'mongoose';
import { DocumentContent } from '@shared/schema';

// Interface for DocumentContent Document
export interface DocumentContentDocument extends Omit<DocumentContent, 'id' | 'documentId'>, Document {
  // We replace 'id' with MongoDB's '_id'
  // Replace documentId with a reference to the Document model
  documentId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Schema for DocumentContent
const documentContentSchema = new Schema<DocumentContentDocument>(
  {
    documentId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Document',
      required: true,
      index: true
    },
    content: { 
      type: String, 
      required: true 
    },
    pageNumber: { 
      type: Number,
      default: null // For full content, page number can be null
    },
    processingStatus: {
      type: String,
      enum: ['pending', 'processed', 'error'],
      default: 'pending'
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

// Create and export the DocumentContent model
export const DocumentContentModel = mongoose.model<DocumentContentDocument>('DocumentContent', documentContentSchema);