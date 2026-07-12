// qwen-prompt-server(/v1/prompts/refine)의 실제 응답 형태 — Python Pydantic 필드명(snake_case) 그대로 유지
// (schemas.py PromptRefineSuccess / PromptRefineError). 매핑 레이어 없이 와이어 포맷과 1:1.
//
// ⚠️ 이 파일은 "받는 과정"의 타입만 정의한다. 프롬프트 내용(system prompt) 확장은 별도 작업 —
// 지금은 게이트웨이가 이미 지원하는 target_type("avatar"|"asset")만 사용.

export interface SpriteRequirements {
  background: "transparent" | "simple" | "none" | "parallax_ready";
  view: "front_idle" | "side_view" | "three_quarter" | "top_down" | "single_object" | "tile";
  framing: "full_body" | "centered_single_asset" | "modular_tile" | "portrait";
  style: "2d_platformer_sprite";
  recommended_size: "512x512";
}

export interface RefinePromptSuccess {
  ok: true;
  request_id: string;
  target_type: "avatar" | "asset";
  visual_summary_ko: string;
  user_intent_ko: string;
  wan_prompt: string;
  wan_negative_prompt: string;
  sprite_requirements: SpriteRequirements;
  safety_flags: string[];
  warnings: string[];
  confidence: number;
  schema_version: string;
  model: string;
  engine: "vllm";
  latency_ms: number;
}

export interface RefinePromptError {
  ok: false;
  request_id: string | null;
  error: { code: string; message: string };
}

export type RefinePromptResult = RefinePromptSuccess | RefinePromptError;

export interface RefinePromptParams {
  requestId: string;
  userId: string;
  targetType: "avatar" | "asset";
  userPrompt: string;
  image: Buffer;
  imageFilename?: string;
  locale?: string;
  stylePreset?: string;
  outputLanguage?: string;
  assetType?: string;
}
