import express from 'express';
import cors from 'cors';
import { connectDB } from './config/database';
import documentsRouter from './routes/documents';
import authRouter from './routes/auth';
import metadataRouter from './routes/metadata';
import { authenticateToken } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB().catch(console.error);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/documents', authenticateToken, documentsRouter);
app.use('/api/metadata', authenticateToken, metadataRouter);

// Create uploads directory if it doesn't exist
import { mkdir } from 'fs/promises';
mkdir('uploads').catch(() => { });

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 