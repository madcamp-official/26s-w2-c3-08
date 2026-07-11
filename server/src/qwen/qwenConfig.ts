import { z } from "zod";

import { QwenConfigurationError } from "./qwenErrors.js";

export const DEFAULT_QWEN_BASE_URL = "http://192.168.0.170:8001";
export const DEFAULT_QWEN_TIMEOUT_MS = 45_000;

const qwenEnvSchema = z.object({
  QWEN_BASE_URL: z.string().url().default(DEFAULT_QWEN_BASE_URL),
  QWEN_API_TOKEN: z.string().optional(),
  QWEN_TIMEOUT_MS: z.coerce.number().int().positive().default(DEFAULT_QWEN_TIMEOUT_MS)
});

export type QwenConfig = {
  baseUrl: string;
  apiToken?: string;
  timeoutMs: number;
};

export function getQwenConfig(env: NodeJS.ProcessEnv = process.env): QwenConfig {
  const parsed = qwenEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new QwenConfigurationError(
      "QWEN_CONFIG_INVALID",
      "Qwen environment configuration is invalid",
      parsed.error.flatten()
    );
  }

  return {
    baseUrl: parsed.data.QWEN_BASE_URL.replace(/\/+$/, ""),
    apiToken: parsed.data.QWEN_API_TOKEN?.trim(),
    timeoutMs: parsed.data.QWEN_TIMEOUT_MS
  };
}

export function requireQwenApiToken(config: QwenConfig = getQwenConfig()): string {
  if (!config.apiToken || isPlaceholderToken(config.apiToken)) {
    throw new QwenConfigurationError(
      "QWEN_API_TOKEN_MISSING",
      "QWEN_API_TOKEN must be configured with the real Qwen internal token"
    );
  }

  return config.apiToken;
}

function isPlaceholderToken(token: string): boolean {
  const normalized = token.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized.startsWith("<") ||
    normalized.includes("real_shared_qwen_internal_token") ||
    normalized.includes("changeme") ||
    normalized.includes("placeholder")
  );
}
