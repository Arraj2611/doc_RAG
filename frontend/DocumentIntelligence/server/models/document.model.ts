import mongoose, { Document as MongoDocument, Schema } from 'mongoose';
import { Document } from '@shared/schema';

// Interface for Document Document (extending the shared Document type)
export interface DocumentDocument extends Omit<Document, 'id' | 'userId'>, MongoDocument {
  // We replace 'id' with MongoDB's '_id'
  // Replace userId with a reference to the User model
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Schema for Document
const documentSchema = new Schema<DocumentDocument>(
  {
    name: { 
      type: String, 
      required: true 
    },
    fileType: { 
      type: String, 
      required: true 
    },
    fileSize: { 
      type: Number, 
      required: true 
    },
    status: { 
      type: String,
      enum: ['processing', 'ready', 'error'],
      default: 'processing' 
    },
    pageCount: { 
      type: Number,
      default: null 
    },
    uploadedAt: { 
      type: Date,
      default: Date.now 
    },
    lastOpenedAt: { 
      type: Date,
      default: null 
    },
    thumbnail: { 
      type: String,
      default: null 
    },
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User',
      required: true
    },
    tags: {
      type: [String],
      default: []
    },
    categories: {
      type: [String],
      default: []
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

// Add index for faster queries by userId
documentSchema.index({ userId: 1 });

// Create and export the Document model
export const DocumentModel = mongoose.model<DocumentDocument>('Document', documentSchema);