import { z } from "zod";

export const qwenSpriteRequirementsSchema = z.object({
  background: z.string().min(1),
  view: z.string().min(1),
  framing: z.string().min(1),
  style: z.string().min(1),
  recommended_size: z.string().min(1)
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
});

export const qwenErrorSchema = z.object({
  ok: z.literal(false),
  request_id: z.string().nullable(),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1)
  })
});

export type QwenRefineSuccess = z.infer<typeof qwenRefineSuccessSchema>;

export const qwenRefineInputSchema = z.object({
  requestId: z.string().min(1),
  userId: z.string().min(1),
  targetType: z.enum(["avatar", "asset"]),
  userPrompt: z.string().min(1).max(500),
  locale: z.string().default("ko-KR"),
  stylePreset: z.string().default("platformer_sprite"),
  outputLanguage: z.string().default("en"),
  assetType: z.enum(["DEVICE", "TERRAIN", "ENEMY", "ITEM", "BACKGROUND"]).optional(),
  imageBuffer: z.instanceof(Buffer),
  imageMime: z.enum(["image/png", "image/jpeg", "image/webp"]),
  imageFilename: z.string().min(1)
});

export type QwenRefineInput = z.infer<typeof qwenRefineInputSchema>;
