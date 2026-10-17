import express from "express";
import fs from "fs";
import path from "path";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "@/routes/auth";
import patientsRoutes from "@/routes/patients";
import reportsRoutes from "@/routes/reports";
import testsRoutes from "@/routes/tests";
import testRoutes from "@/routes/test";
import settingsRoutes from "@/routes/settings";
import analyzersRoutes from "@/routes/analyzers";
import { initDatabase } from "@/models";

const app = express();
const PORT = process.env.PORT || 4000;

const uploadsDir =
  process.env.UPLOADS_DIR || path.join(__dirname, "../uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (
        origin.includes("railway.app") ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        origin.includes("codefliq.com")
      ) {
        return callback(null, true);
      }
      const allowed = process.env.FRONTEND_URL;
      if (allowed && origin === allowed) return callback(null, true);
      callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

app.use("/uploads", express.static(uploadsDir));

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/tests", testsRoutes);
app.use("/api/test", testRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/analyzers", analyzersRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const startServer = async () => {
  try {
    await initDatabase();
    console.log("Database initialized successfully");

    // Always bind IPv4 loopback — Electron/Next use 127.0.0.1, not ::1.
    app.listen(Number(PORT), "127.0.0.1", () => {
      console.log(`Express API server running on http://127.0.0.1:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
