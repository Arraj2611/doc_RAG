import express from 'express';
import {
  getChatSessions,
  getChatHistory,
  createChatSession,
  addMessagesToHistory,
} from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply protect middleware to all routes in this file
router.use(protect);

// Define routes
router.get('/', getChatSessions);
router.post('/', createChatSession);
router.get('/:sessionId', getChatHistory);
router.put('/:sessionId', addMessagesToHistory);

export default router; 