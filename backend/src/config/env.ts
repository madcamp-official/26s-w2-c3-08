import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  QWEN_BASE_URL: z.string().url().default("http://172.10.5.138:8001"),
  QWEN_API_TOKEN: z.string().optional(),
  QWEN_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  WORKER_TOKEN: z.string().optional(),
  INTERNAL_API_TOKEN: z.string().optional(),
  IMAGE_STORAGE_MODE: z.enum(["inline", "local", "http-put"]).optional(),
  IMAGE_STORAGE_DIR: z.string().optional(),
  IMAGE_PUBLIC_PATH: z.string().default("/generated-assets")
});

export const env = envSchema.parse(process.env);

export interface BackendReadiness {
  ok: boolean;
  service: "relay-map-maker-backend";
  environment: "development" | "test" | "production";
  checks: {
    corsOrigins: number;
    qwenConfigured: boolean;
    workerAuthConfigured: boolean;
    internalAuthConfigured: boolean;
    imageStorageMode: "inline" | "local" | "http-put";
    imageStorageConfigured: boolean;
    generatedAssetStaticServing: boolean;
  };
}

export function parseCorsOrigins(value: string): string | string[] {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length <= 1 ? origins[0] ?? value : [...new Set(origins)];
}

export function getBackendReadiness(currentEnv = env): BackendReadiness {
  const production = currentEnv.NODE_ENV === "production";
  const corsOrigins = parseCorsOrigins(currentEnv.CORS_ORIGIN);
  const imageStorageMode = getBackendImageStorageMode(currentEnv);
  const checks = {
    corsOrigins: Array.isArray(corsOrigins) ? corsOrigins.length : 1,
    qwenConfigured: isRealSecret(currentEnv.QWEN_API_TOKEN),
    workerAuthConfigured: isRealSecret(currentEnv.WORKER_TOKEN),
    internalAuthConfigured: isRealSecret(currentEnv.INTERNAL_API_TOKEN),
    imageStorageMode,
    imageStorageConfigured:
      imageStorageMode === "http-put" ||
      (imageStorageMode === "local" && Boolean(currentEnv.IMAGE_STORAGE_DIR && currentEnv.IMAGE_PUBLIC_PATH)),
    generatedAssetStaticServing:
      imageStorageMode === "local" && Boolean(currentEnv.IMAGE_STORAGE_DIR && currentEnv.IMAGE_PUBLIC_PATH)
  };

  return {
    ok: production
      ? checks.corsOrigins > 0 &&
        checks.qwenConfigured &&
        checks.workerAuthConfigured &&
        checks.internalAuthConfigured &&
        checks.imageStorageConfigured
      : true,
    service: "relay-map-maker-backend",
    environment: currentEnv.NODE_ENV,
    checks
  };
}

export function getBackendImageStorageMode(currentEnv = env): "inline" | "local" | "http-put" {
  if (currentEnv.IMAGE_STORAGE_MODE) {
    return currentEnv.IMAGE_STORAGE_MODE;
  }

  return currentEnv.IMAGE_STORAGE_DIR ? "local" : "inline";
}

export function requireQwenToken(): string {
  if (!env.QWEN_API_TOKEN || env.QWEN_API_TOKEN.startsWith("<REAL_")) {
    throw new Error("QWEN_API_TOKEN is not configured with a real internal token");
  }

  return env.QWEN_API_TOKEN;
}

function isRealSecret(value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  const placeholderFragments = [
    "<real",
    "<replace",
    "replace-with",
    "changeme",
    "change-me",
    "placeholder",
    "dummy",
    "example",
    "todo",
    "your-"
  ];

  return (
    normalized.length >= 16 &&
    normalized !== "dev-worker-token" &&
    !placeholderFragments.some((fragment) => normalized.includes(fragment))
  );
}
