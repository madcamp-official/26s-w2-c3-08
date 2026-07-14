import cors from "cors";
import express from "express";
import { env, getBackendImageStorageMode, getBackendReadiness, parseCorsOrigins } from "../config/env.js";
import { apiRoutes } from "./routes/apiRoutes.js";
import { qwenRoutes } from "./routes/qwenRoutes.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: parseCorsOrigins(env.CORS_ORIGIN) }));
  app.use(express.json({ limit: "10mb" }));

  if (getBackendImageStorageMode() === "local" && env.IMAGE_STORAGE_DIR) {
    app.use(env.IMAGE_PUBLIC_PATH, express.static(env.IMAGE_STORAGE_DIR));
  }

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "relay-map-maker-backend"
    });
  });

  app.get("/ready", (_req, res) => {
    const readiness = getBackendReadiness();

    res.status(readiness.ok ? 200 : 503).json(readiness);
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
