import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { env, getBackendImageStorageMode, getBackendReadiness, parseCorsOrigins } from "../config/env.js";
import { apiRoutes } from "./routes/apiRoutes.js";
import { qwenRoutes } from "./routes/qwenRoutes.js";

export interface CreateAppOptions {
  clientDistDir?: string | null;
}

const defaultClientDistDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../client/dist");

export function createApp(options: CreateAppOptions = {}) {
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

  const clientDistDir = options.clientDistDir ?? env.CLIENT_DIST_DIR ?? defaultClientDistDir;
  const clientIndexPath = clientDistDir ? resolve(clientDistDir, "index.html") : null;

  if (clientDistDir && clientIndexPath && existsSync(clientIndexPath)) {
    app.use(express.static(clientDistDir, {
      fallthrough: true,
      index: false
    }));

    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/internal") || req.path.startsWith("/socket.io")) {
        next();
        return;
      }

      res.sendFile(clientIndexPath);
    });
  }

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
