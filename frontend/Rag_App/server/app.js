import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";


const app = express();

// Connect to the database
connectDB();

app.use(express.json());
app.use(cors());

app.use("/api/auth", authRoutes);


export default app;
