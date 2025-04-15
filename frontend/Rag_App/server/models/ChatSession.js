import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    enum: ['user', 'assistant'], // Restrict role values
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const ChatSessionSchema = new mongoose.Schema({
  sessionId: {
    // This might be the UUID generated on the frontend
    type: String,
    required: true,
    unique: true,
    index: true, // Index for faster lookups
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    default: 'New Chat',
  },
  history: [MessageSchema], // Array of messages
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Middleware to update the `updatedAt` field on save
ChatSessionSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('ChatSession', ChatSessionSchema); 