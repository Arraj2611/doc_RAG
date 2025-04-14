// Server configuration
export const config = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/doc_rag',
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  FASTAPI_URL: process.env.FASTAPI_URL || 'http://localhost:8000',
  NODE_ENV: process.env.NODE_ENV || 'development',
};
