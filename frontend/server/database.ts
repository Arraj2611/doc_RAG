import mongoose from 'mongoose';
import { log } from './vite';

// MongoDB connection URI - using MongoDB Atlas or local connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/documind';

// Function to connect to MongoDB
export async function connectToDatabase() {
  try {
    // Add connection options to improve reliability
    const options = {
      autoIndex: true,
      connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
      socketTimeoutMS: 45000,  // Close sockets after 45 seconds of inactivity
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      maxPoolSize: 10, // Maintain up to 10 socket connections
    };

    log('Attempting to connect to MongoDB...', 'database');
    await mongoose.connect(MONGODB_URI, options);
    log('Connected to MongoDB', 'database');
    return mongoose.connection;
  } catch (error) {
    log(`Error connecting to MongoDB: ${error}`, 'database');
    
    // Handle the error gracefully - use in-memory fallback
    log('Using in-memory storage as fallback', 'database');
    return null; // Return null instead of exiting
  }
}

// Event listeners for MongoDB connection
mongoose.connection.on('connected', () => {
  log('MongoDB connection established', 'database');
});

mongoose.connection.on('error', (err) => {
  log(`MongoDB connection error: ${err}`, 'database');
});

mongoose.connection.on('disconnected', () => {
  log('MongoDB connection disconnected', 'database');
});

// Graceful shutdown - only handle DB-specific shutdown here
// The main shutdown is handled in index.ts
process.on('SIGINT', async () => {
  if (mongoose.connection.readyState !== 0) { // 0 = disconnected
    try {
      await mongoose.connection.close();
      log('MongoDB connection closed due to app termination', 'database');
    } catch (err) {
      log(`Error closing MongoDB connection: ${err}`, 'database');
    }
  }
});

export default mongoose;