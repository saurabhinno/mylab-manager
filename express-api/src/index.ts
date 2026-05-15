import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "@/routes/auth";
import patientsRoutes from "@/routes/patients";
import reportsRoutes from "@/routes/reports";
import testsRoutes from "@/routes/tests";
import testRoutes from "@/routes/test";
import settingsRoutes from "@/routes/settings";
import { initDatabase } from "@/models";

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/tests", testsRoutes);
app.use("/api/test", testRoutes);
app.use("/api/settings", settingsRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initDatabase();
    console.log("Database initialized successfully");
    
    app.listen(PORT, () => {
      console.log(`Express API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
