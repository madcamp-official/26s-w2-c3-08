import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { QwenClient, QwenClientError } from "../../clients/qwenClient.js";
import { env, isProductionSecretConfigured } from "../../config/env.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1
  }
});

const qwenClient = new QwenClient();

const refineFormSchema = z.object({
  request_id: z.string().min(1),
  user_id: z.string().min(1),
  target_type: z.enum(["avatar", "asset"]),
  user_prompt: z.string().min(1).max(500),
  locale: z.string().default("ko-KR"),
  style_preset: z.string().default("platformer_sprite"),
  output_language: z.string().default("en"),
  asset_type: z.enum(["DEVICE", "TERRAIN", "ENEMY", "ITEM", "BACKGROUND"]).optional()
});

const allowedImageMimes = new Set(["image/png", "image/jpeg", "image/webp"]);

export const qwenRoutes = Router();

qwenRoutes.use((req, res, next) => {
  const authResult = validateInternalRouteToken({
    nodeEnv: env.NODE_ENV,
    expectedToken: env.INTERNAL_API_TOKEN,
    authorization: req.headers.authorization,
    backendInternalToken: req.headers["x-backend-internal-token"]
  });

  if (authResult.ok) {
    next();
    return;
  }

  res.status(authResult.status).json({
    ok: false,
    error: {
      code: authResult.code,
      message: authResult.message
    }
  });
});

qwenRoutes.get("/health", async (_req, res) => {
  try {
    const qwen = await qwenClient.health();
    res.json({ ok: true, qwen });
  } catch (error) {
    sendQwenError(res, error);
  }
});

qwenRoutes.get("/model", async (_req, res) => {
  try {
    const qwen = await qwenClient.model();
    res.json({ ok: true, qwen });
  } catch (error) {
    sendQwenError(res, error);
  }
});

qwenRoutes.post("/refine", upload.single("image"), async (req, res) => {
  try {
    const form = refineFormSchema.parse(req.body);
    if (!req.file) {
      res.status(400).json({
        ok: false,
        error: { code: "IMAGE_REQUIRED", message: "image file is required" }
      });
      return;
    }

    if (!allowedImageMimes.has(req.file.mimetype)) {
      res.status(400).json({
        ok: false,
        error: {
          code: "INVALID_IMAGE_TYPE",
          message: "image must be PNG, JPEG, or WEBP"
        }
      });
      return;
    }

    const qwen = await qwenClient.refinePrompt({
      requestId: form.request_id,
      userId: form.user_id,
      targetType: form.target_type,
      userPrompt: form.user_prompt,
      locale: form.locale,
      stylePreset: form.style_preset,
      outputLanguage: form.output_language,
      assetType: form.asset_type,
      imageBuffer: req.file.buffer,
      imageMime: req.file.mimetype as "image/png" | "image/jpeg" | "image/webp",
      imageFilename: req.file.originalname || `${form.request_id}.png`
    });

    res.json({ ok: true, qwen });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "request form did not match the Qwen refine contract",
          details: error.flatten()
        }
      });
      return;
    }

    sendQwenError(res, error);
  }
});

export function validateInternalRouteToken({
  nodeEnv,
  expectedToken,
  authorization,
  backendInternalToken
}: {
  nodeEnv: "development" | "test" | "production";
  expectedToken: string | undefined;
  authorization?: string | string[];
  backendInternalToken?: string | string[];
}): { ok: true } | { ok: false; status: number; code: string; message: string } {
  if (!expectedToken) {
    if (nodeEnv === "production") {
      return {
        ok: false,
        status: 503,
        code: "INTERNAL_API_TOKEN_MISSING",
        message: "internal API token is required"
      };
    }

    return { ok: true };
  }

  if (nodeEnv === "production" && !isProductionSecretConfigured(expectedToken)) {
    return {
      ok: false,
      status: 503,
      code: "INTERNAL_API_TOKEN_UNSAFE",
      message: "internal API token must be replaced with a real production secret"
    };
  }

  const providedToken = readInternalAuthToken(authorization) ?? readHeaderString(backendInternalToken);

  if (providedToken !== expectedToken) {
    return {
      ok: false,
      status: 401,
      code: "INTERNAL_API_AUTHENTICATION_FAILED",
      message: "internal API authentication failed"
    };
  }

  return { ok: true };
}

function readInternalAuthToken(authorization: string | string[] | undefined) {
  const value = readHeaderString(authorization);

  if (!value) {
    return undefined;
  }

  const [scheme, token] = value.split(/\s+/u);

  return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}

function readHeaderString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function sendQwenError(res: { status: (code: number) => { json: (body: unknown) => void } }, error: unknown) {
  if (error instanceof QwenClientError) {
    const status = error.status > 0 ? error.status : 502;
    res.status(status).json({
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable
      },
      qwen_response: error.responseBody ?? null
    });
    return;
  }

  res.status(500).json({
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Unexpected backend error"
    }
  });
}
