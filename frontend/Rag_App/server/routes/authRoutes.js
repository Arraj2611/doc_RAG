import express from 'express';
// Import named exports from controller
import { registerUser, loginUser } from '../controllers/authController.js';

const router = express.Router();

// Register user route
router.post("/register", registerUser);

// Login user route
router.post("/login", loginUser);

export default router; // Use ES Module export
