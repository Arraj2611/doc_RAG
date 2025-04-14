import mongoose, { Document, Schema } from 'mongoose';
import { User } from '@shared/schema';

// Interface for User Document (extending the shared User type)
export interface UserDocument extends Omit<User, 'id'>, Document {
  // We replace 'id' with MongoDB's '_id'
  createdAt: Date;
  updatedAt: Date;
}

// Schema for User
const userSchema = new Schema<UserDocument>(
  {
    username: { 
      type: String, 
      required: true, 
      unique: true,
      trim: true,
    },
    password: { 
      type: String, 
      required: true 
    },
    displayName: { 
      type: String,
      default: null
    },
    email: { 
      type: String,
      sparse: true, // Allow null but enforce uniqueness when it exists
      index: true,
      trim: true,
      lowercase: true
    },
    profilePic: { 
      type: String,
      default: null 
    },
    role: { 
      type: String,
      enum: ['user', 'admin'],
      default: 'user' 
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

// Create and export the User model
export const UserModel = mongoose.model<UserDocument>('User', userSchema);