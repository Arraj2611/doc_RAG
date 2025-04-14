import mongoose, { Document, Schema } from 'mongoose';
import { ChatMessage } from '@shared/schema';

// Interface for ChatMessage Document
export interface ChatMessageDocument extends Omit<ChatMessage, 'id' | 'userId' | 'documentId'>, Document {
  // We replace 'id' with MongoDB's '_id'
  // Replace userId and documentId with references to their respective models
  userId: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

// Citation Schema (as a subdocument)
const citationSchema = new Schema({
  text: { type: String, required: true },
  page: { type: String, required: true }
}, { _id: false }); // Don't need separate IDs for citations

// Schema for ChatMessage
const chatMessageSchema = new Schema<ChatMessageDocument>(
  {
    content: { 
      type: String, 
      required: true 
    },
    sender: { 
      type: String,
      enum: ['user', 'ai'],
      required: true 
    },
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User',
      required: true,
      index: true
    },
    documentId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Document',
      default: null,
      index: true
    },
    sessionId: {
      type: String,
      default: null,
      index: true
    },
    citations: {
      type: [citationSchema],
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

// Create and export the ChatMessage model
export const ChatMessageModel = mongoose.model<ChatMessageDocument>('ChatMessage', chatMessageSchema);