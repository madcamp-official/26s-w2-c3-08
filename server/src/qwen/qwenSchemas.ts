import { Buffer } from "node:buffer";

import { z } from "zod";

export const qwenHealthSchema = z.object({
  ok: z.boolean(),
  gateway_ok: z.boolean().optional(),
  vllm_ok: z.boolean().optional(),
  model_loaded: z.boolean().optional(),
  engine: z.string().optional(),
  model: z.string().optional(),
  model_path: z.string().optional(),
  model_path_exists: z.boolean().optional(),
  token_configured: z.boolean().optional()
}).passthrough();

export const qwenModelSchema = z.object({
  ok: z.boolean(),
  model_id: z.string().min(1),
  model_path: z.string().optional(),
  engine: z.string().min(1),
  engine_url: z.string().optional(),
  vllm_ok: z.boolean(),
  model_loaded: z.boolean(),
  available_models: z.array(z.string()).optional(),
  model_path_exists: z.boolean().optional(),
  vllm_error_code: z.string().nullable().optional()
}).passthrough();

export const qwenSpriteRequirementsSchema = z.object({
  background: z.enum(["transparent", "simple", "none", "parallax_ready"]),
  view: z.enum([
    "front_idle",
    "side_view",
    "three_quarter",
    "top_down",
    "single_object",
    "tile"
  ]),
  framing: z.enum(["full_body", "centered_single_asset", "modular_tile", "portrait"]),
  style: z.literal("2d_platformer_sprite"),
  recommended_size: z.literal("512x512")
});

export const qwenRefineSuccessSchema = z.object({
  ok: z.literal(true),
  request_id: z.string().min(1),
  schema_version: z.string().min(1),
  model: z.string().min(1),
  engine: z.string().min(1),
  target_type: z.enum(["avatar", "asset"]),
  visual_summary_ko: z.string().min(1),
  user_intent_ko: z.string().min(1),
  wan_prompt: z.string().min(1).max(900),
  wan_negative_prompt: z.string().min(1),
  sprite_requirements: qwenSpriteRequirementsSchema,
  safety_flags: z.array(z.string()),
  warnings: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  latency_ms: z.number().int().nonnegative()
}).passthrough();

export const qwenErrorSchema = z.object({
  ok: z.literal(false),
  request_id: z.string().nullable(),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1)
  }).passthrough()
}).passthrough();

export const qwenTargetTypeSchema = z.enum(["avatar", "asset"]);
export const qwenAssetTypeSchema = z.enum(["DEVICE", "TERRAIN", "ENEMY", "ITEM", "BACKGROUND"]);
export const qwenImageMimeSchema = z.enum(["image/png", "image/jpeg", "image/webp"]);

export const qwenRefineInputSchema = z.object({
  requestId: z.string().min(1),
  userId: z.string().min(1),
  targetType: qwenTargetTypeSchema,
  userPrompt: z.string().min(1).max(500),
  locale: z.string().default("ko-KR"),
  stylePreset: z.string().default("platformer_sprite"),
  outputLanguage: z.string().default("en"),
  assetType: qwenAssetTypeSchema.optional(),
  imageBuffer: z.instanceof(Buffer).refine((buffer) => buffer.length > 0, {
    message: "imageBuffer must contain the uploaded image bytes"
  }),
  imageMime: qwenImageMimeSchema,
  imageFilename: z.string().min(1)
}).superRefine((value, ctx) => {
  if (value.targetType === "asset" && !value.assetType) {
    ctx.addIssue({
      code: "custom",
      path: ["assetType"],
      message: "assetType is required when targetType is asset"
    });
  }
});

export const qwenRefineJobPayloadSchema = z.object({
  jobId: z.string().min(1),
  userId: z.string().min(1),
  targetType: qwenTargetTypeSchema,
  userPrompt: z.string().min(1).max(500),
  assetType: qwenAssetTypeSchema.optional(),
  imageBuffer: z.instanceof(Buffer).refine((buffer) => buffer.length > 0, {
    message: "imageBuffer must contain the uploaded image bytes"
  }),
  imageMime: qwenImageMimeSchema,
  imageFilename: z.string().min(1)
}).superRefine((value, ctx) => {
  if (value.targetType === "asset" && !value.assetType) {
    ctx.addIssue({
      code: "custom",
      path: ["assetType"],
      message: "assetType is required when targetType is asset"
    });
  }
});

export type QwenHealth = z.infer<typeof qwenHealthSchema>;
export type QwenModel = z.infer<typeof qwenModelSchema>;
export type QwenRefineSuccess = z.infer<typeof qwenRefineSuccessSchema>;
export type QwenErrorResponse = z.infer<typeof qwenErrorSchema>;
export type QwenRefineInput = z.infer<typeof qwenRefineInputSchema>;
export type QwenRefineJobPayload = z.infer<typeof qwenRefineJobPayloadSchema>;
