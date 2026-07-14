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
  IMAGE_STORAGE_DIR: z.string().optional(),
  IMAGE_PUBLIC_PATH: z.string().default("/generated-assets")
});

export const env = envSchema.parse(process.env);

export function parseCorsOrigins(value: string): string | string[] {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length <= 1 ? origins[0] ?? value : [...new Set(origins)];
}

export function requireQwenToken(): string {
  if (!env.QWEN_API_TOKEN || env.QWEN_API_TOKEN.startsWith("<REAL_")) {
    throw new Error("QWEN_API_TOKEN is not configured with a real internal token");
  }

  return env.QWEN_API_TOKEN;
}
