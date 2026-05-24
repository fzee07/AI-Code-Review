import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import connectDB from "./config/db";
import authRoutes from "./modules/auth/auth.routes";
import webhookRoutes from "./modules/webhook/webhook.routes";
import reviewRoutes from "./modules/review/review.routes";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/reviews", reviewRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "AI Code Review API is running",
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════╗
    ║   Auto AI Code Review API                    ║
    ║   Running on: http://localhost:${PORT}          ║
    ║   AI: Google Gemini (only)                   ║
    ║   Webhook: /api/webhooks/github              ║
    ╚══════════════════════════════════════════════╝
    `);
  });
};

startServer();
export default app;
