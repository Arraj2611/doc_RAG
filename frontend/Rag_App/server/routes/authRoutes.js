import express from "express";
import authController from "../controllers/authController.js";

const router = express.Router();

// Register user route
router.post("/register", authController.registerUser);

// Login user route
router.post("/login", authController.loginUser);

export default router;
