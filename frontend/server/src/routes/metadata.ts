import express from 'express';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get all tags
router.get('/tags', authenticateToken, (_req, res) => {
    res.json([
        { id: '1', name: 'Important' },
        { id: '2', name: 'Work' },
        { id: '3', name: 'Personal' },
        { id: '4', name: 'Finance' },
        { id: '5', name: 'Legal' }
    ]);
});

// Get all categories
router.get('/categories', authenticateToken, (_req, res) => {
    res.json([
        { id: '1', name: 'Contracts' },
        { id: '2', name: 'Reports' },
        { id: '3', name: 'Invoices' },
        { id: '4', name: 'Receipts' },
        { id: '5', name: 'Notes' }
    ]);
});

export default router; 