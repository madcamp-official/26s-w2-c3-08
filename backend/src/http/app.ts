import cors from "cors";
import express from "express";
import { env } from "../config/env.js";
import { apiRoutes } from "./routes/apiRoutes.js";
import { qwenRoutes } from "./routes/qwenRoutes.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: "10mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "relay-map-maker-backend",
      qwen_base_url: env.QWEN_BASE_URL
    });
  });

  app.use("/api", apiRoutes);
  app.use("/internal/qwen", qwenRoutes);

  app.use((_req, res) => {
    res.status(404).json({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "route not found"
      }
    });
  });

  return app;
}
