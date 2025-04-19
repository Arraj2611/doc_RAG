import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { DocumentModel } from '../models/Document';
import { authenticateToken } from '../middleware/auth';
import { processDocument } from '../services/documentProcessor';

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

// Create uploads directory if it doesn't exist
async function ensureUploadsDir() {
    try {
        await fs.access(uploadsDir);
    } catch (error) {
        await fs.mkdir(uploadsDir, { recursive: true });
    }
}

ensureUploadsDir().catch(console.error);

const storage = multer.diskStorage({
    destination: async (_req, _file, cb) => {
        try {
            await ensureUploadsDir();
            cb(null, uploadsDir);
        } catch (error) {
            console.error('Error ensuring uploads directory:', error);
            cb(error as Error, uploadsDir);
        }
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${path.basename(file.originalname, ext)}-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (_req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type. Received: ${file.mimetype}. Allowed types: PDF and Word documents.`));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Error handling middleware for multer
const handleUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    upload.single('file')(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer error:', err);
            return res.status(400).json({
                error: `File upload error: ${err.message}`,
                code: err.code
            });
        } else if (err) {
            console.error('Upload error:', err);
            return res.status(400).json({
                error: err.message || 'Unknown upload error'
            });
        }
        next();
    });
};

// Get all documents
router.get('/', async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const documents = await DocumentModel.find({ userId: req.user.id })
            .sort({ lastOpened: -1 });
        res.json(documents);
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// Upload a new document
router.post('/upload', handleUpload, async (req, res) => {
    console.log('Processing upload request...');
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (!req.file) {
            console.error('No file in request');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('File received:', {
            filename: req.file.filename,
            mimetype: req.file.mimetype,
            size: req.file.size
        });

        let options = {};
        try {
            options = JSON.parse(req.body.options || '{}');
            console.log('Parsed options:', options);
        } catch (error) {
            console.warn('Invalid options JSON:', error);
        }

        // Create initial document record
        const document = new DocumentModel({
            userId: req.user.id,
            name: req.file.originalname,
            size: req.file.size,
            type: path.extname(req.file.originalname).substring(1).toLowerCase(),
            uploadedAt: new Date(),
            lastOpened: new Date(),
            categories: (options as any).categories || [],
            tags: (options as any).tags || [],
            status: 'processing'
        });

        console.log('Saving document to database...');
        await document.save();
        console.log('Document saved successfully:', document.id);

        // Start document processing in the background
        processDocument(document.id, req.file.path, options)
            .catch(error => {
                console.error('Error processing document:', error);
                document.status = 'error';
                document.error = error instanceof Error ? error.message : 'Unknown error occurred';
                document.save().catch(err => {
                    console.error('Error saving document error status:', err);
                });
            });

        res.status(201).json(document);
    } catch (error) {
        console.error('Error in upload route:', error);

        // Clean up uploaded file if it exists
        if (req.file?.path) {
            fs.unlink(req.file.path).catch(err => {
                console.error('Error deleting uploaded file:', err);
            });
        }

        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to upload document',
            details: error instanceof Error ? error.stack : undefined
        });
    }
});

// Delete a document
router.delete('/:id', async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const document = await DocumentModel.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// Search documents
router.get('/search', async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const documents = await DocumentModel.find({
            userId: req.user.id,
            $text: { $search: q as string }
        }, {
            score: { $meta: 'textScore' }
        })
            .sort({ score: { $meta: 'textScore' } })
            .limit(20);

        res.json(documents);
    } catch (error) {
        console.error('Error searching documents:', error);
        res.status(500).json({ error: 'Failed to search documents' });
    }
});

// Get all tags
router.get('/tags', async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // For now, return an empty array or some default tags
        res.json([]);
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ error: 'Failed to fetch tags' });
    }
});

// Get all categories
router.get('/categories', async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // For now, return an empty array or some default categories
        res.json([]);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

export default router; 