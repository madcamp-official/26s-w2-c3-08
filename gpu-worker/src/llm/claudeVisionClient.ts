// Claude API로 "이미지 보고 외형 서술" 단계만 수행하는 클라이언트 — 3090 Qwen 게이트웨이의 대체재.
// 배경: Qwen2-VL-7B가 system prompt의 IP 규칙("저작권 캐릭터명 금지")을 무시하고 "A Mario character,
// white helmet, blue scarf"처럼 이름+환각 디테일을 뽑는 것을 실측 확인(2026-07-16) — 프롬프트 문제가
// 아니라 7B 모델의 instruction-following 한계라 모델 교체로 해결.
//
// 계약: PromptGatewayClient.refine()과 동일한 RefinePromptResult를 반환 — 오케스트레이터는 무수정.
// system prompt는 qwen-prompt-server/prompts.py의 SYSTEM_PROMPT를 이식(내용 동일 기준, JSON 강제
// 보일러플레이트는 structured outputs가 대체하므로 제거).
import Anthropic from "@anthropic-ai/sdk";
import { ConcurrencyLimiter } from "./concurrencyLimiter.js";
import type { AppearanceRefiner, RefinePromptParams, RefinePromptResult, SpriteRequirements } from "./types.js";

export interface ClaudeVisionConfig {
  apiKey: string;
  /** 기본 claude-haiku-4-5 — 짧은 외형 서술엔 충분하고 최저가. CLAUDE_VISION_MODEL로 교체 가능 */
  model?: string;
  maxConcurrency?: number;
  timeoutMs?: number;
}

const DEFAULT_MODEL = "claude-haiku-4-5";

// prompts.py SYSTEM_PROMPT 이식본. wan_prompt 규칙(외형만·포즈/뷰/배경 금지)과 안전/IP 규칙은 원문 유지.
const SYSTEM_PROMPT = `
You are the prompt-refinement engine for a 2D multiplayer platformer game.

You receive exactly one user-provided reference image and one user prompt.
The user prompt may be Korean, English, short, vague, misspelled, or playful.
Your job is to understand the image, infer the user's practical intent, and produce a JSON object.

IMPORTANT — how wan_prompt is used downstream:
- wan_prompt is NOT a standalone image prompt. It is only the APPEARANCE / IDENTITY description of the subject.
- A separate animation pipeline appends the pose, camera angle / view direction, framing, background, and motion for each animation action (idle, walk, jump, etc.).
- Therefore wan_prompt must describe ONLY what the subject looks like: subject type, key visual traits, colors, materials, and art style.
- wan_prompt must NOT contain any pose, action, motion, camera angle, view direction (front/side), framing (full-body/centered), or background — the pipeline adds those. Including them causes conflicts.

CRITICAL — describe what you SEE, not what you recognize:
- Describe the actual pixels of the image: exact colors, shapes, and features that are literally visible.
- If the drawing resembles a famous character, do NOT name it and do NOT add features the famous character has but the drawing does not. Example: if the drawing has one dot eye, say one dot eye — do not add two eyes, a mustache, a helmet, or a scarf because the "recognized" character has them.
- Do not invent hidden details that are not visible or implied.

Game art direction (applies to the appearance you describe):
- The subject is a readable 2D platformer sprite.
- Prefer clean silhouettes, crisp edges, simple shapes, and strong readability at small size.
- Prefer sprite-sheet-friendly detail, not complex painterly rendering.
- Avoid photorealism unless the user explicitly asks for a realistic object, and even then adapt it to 2D sprite style.
- Never describe backgrounds, scenery, text, watermarks, UI panels, logos, frames, or decorative borders — the subject only.
- Do NOT describe pose, stance, view angle, or framing — those are added downstream.

Avatar rules:
- If target_type is "avatar", describe the character's appearance only (body type, clothing, colors, distinctive features, art style).
- The character should be game-ready, readable, and not too detailed.
- Keep anatomy simple and stable.

Asset rules:
- If target_type is "asset", describe one isolated game asset's appearance, not a full scene.
- Use asset_type to decide the subject: DEVICE = interactive obstacle/switch/platform/trap/launcher/door/mechanism; TERRAIN = ground/block/wall/bridge/slope-like block/tile/platform surface; ENEMY = a simple readable enemy sprite; ITEM = collectible/key/power-up/coin/potion/token/goal object; BACKGROUND = a decorative scenery element (describe the element's look only, not a full scene).
- Describe only the object's appearance — never its pose, placement, view, or surroundings.

Safety and IP rules:
- Do not include copyrighted character names in wan_prompt.
- Do not include celebrity likeness.
- Do not include brand logos, trademarks, or watermark requests.
- If the user asks for a copyrighted or famous character, transform it into a generic original character with similar high-level traits.
- If the user asks for a real person, transform it into a generic fictional character.
- Refuse or sanitize gore, sexual content, explicit nudity, hateful symbols, and realistic violence.
- For unsafe or disallowed content, keep ok true only if a safe transformed sprite prompt can be produced. Add a warning and safety flag.

Output language rules (STRICT):
- visual_summary_ko must be Korean.
- user_intent_ko must be Korean.
- wan_prompt must be written ENTIRELY in English. No Korean characters (Hangul) are allowed anywhere in wan_prompt.
- wan_negative_prompt must be written ENTIRELY in English. No Hangul.
- warnings may be Korean or English, but Korean is preferred for backend/debug readability.
- safety_flags must use uppercase snake case strings.

Field requirements:
- ok must be true.
- target_type must match the request target_type.
- visual_summary_ko must describe what is actually visible in the image in 1 to 3 Korean sentences.
- user_intent_ko must summarize the user's requested intent in 1 to 2 Korean sentences.
- wan_prompt must be a single English prompt under 900 characters.
- wan_prompt must include ONLY: the subject/object, its key visual traits, colors/materials, and art style.
- wan_negative_prompt must include common exclusions such as photorealistic, 3D render, blurry, low quality, text, watermark, logo, extra limbs, malformed anatomy, gore.
- confidence must be a number between 0 and 1.

Good wan_prompt style (appearance only, no pose/view/background):
"An original tiny explorer character, round helmet, bright teal scarf, simple brown boots, friendly round face, clean silhouette, crisp pixel-inspired 2D platformer game art, readable at small size."

Bad wan_prompt style:
- Contains pose/view/background words: "front-facing", "idle", "standing", "side view", "centered composition", "transparent background", "512x512"
- Any Korean characters
- Mentions copyrighted names
- Describes details not visible in the image
`.trim();

// 게이트웨이와 동일한 응답 골격을 structured outputs로 강제 — JSON 파싱 실패 경로 자체가 없음.
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    target_type: { type: "string", enum: ["avatar", "asset"] },
    visual_summary_ko: { type: "string" },
    user_intent_ko: { type: "string" },
    wan_prompt: { type: "string" },
    wan_negative_prompt: { type: "string" },
    sprite_requirements: {
      type: "object",
      properties: {
        background: { type: "string", enum: ["transparent", "simple", "none", "parallax_ready"] },
        view: { type: "string", enum: ["front_idle", "side_view", "three_quarter", "top_down", "single_object", "tile"] },
        framing: { type: "string", enum: ["full_body", "centered_single_asset", "modular_tile", "portrait"] },
        style: { type: "string", enum: ["2d_platformer_sprite"] },
        recommended_size: { type: "string", enum: ["512x512"] },
      },
      required: ["background", "view", "framing", "style", "recommended_size"],
      additionalProperties: false,
    },
    safety_flags: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
  },
  required: [
    "ok", "target_type", "visual_summary_ko", "user_intent_ko", "wan_prompt",
    "wan_negative_prompt", "sprite_requirements", "safety_flags", "warnings", "confidence",
  ],
  additionalProperties: false,
} as const;

type ModelOutput = {
  ok: boolean;
  target_type: "avatar" | "asset";
  visual_summary_ko: string;
  user_intent_ko: string;
  wan_prompt: string;
  wan_negative_prompt: string;
  sprite_requirements: SpriteRequirements;
  safety_flags: string[];
  warnings: string[];
  confidence: number;
};

export class ClaudeVisionClient implements AppearanceRefiner {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly limiter: ConcurrencyLimiter;

  constructor(config: ClaudeVisionConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeoutMs ?? 60_000,
      // 429/5xx는 SDK 내장 재시도(기본 2회)에 위임
    });
    this.model = config.model ?? DEFAULT_MODEL;
    this.limiter = new ConcurrencyLimiter(config.maxConcurrency ?? 4);
  }

  async refine(params: RefinePromptParams): Promise<RefinePromptResult> {
    return this.limiter.run(() => this.requestOnce(params));
  }

  private async requestOnce(params: RefinePromptParams): Promise<RefinePromptResult> {
    const started = Date.now();
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeFromFilename(params.imageFilename),
                  data: params.image.toString("base64"),
                },
              },
              {
                type: "text",
                text: buildUserText(params),
              },
            ],
          },
        ],
      });

      if (response.stop_reason === "refusal") {
        return errorResult(params.requestId, "CLAUDE_REFUSAL", "model refused the request");
      }
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        return errorResult(params.requestId, "CLAUDE_EMPTY", `no text block (stop_reason=${response.stop_reason})`);
      }
      const parsed = JSON.parse(textBlock.text) as ModelOutput;
      return {
        ok: true,
        request_id: params.requestId,
        target_type: parsed.target_type,
        visual_summary_ko: parsed.visual_summary_ko,
        user_intent_ko: parsed.user_intent_ko,
        wan_prompt: parsed.wan_prompt,
        wan_negative_prompt: parsed.wan_negative_prompt,
        sprite_requirements: parsed.sprite_requirements,
        safety_flags: parsed.safety_flags,
        warnings: parsed.warnings,
        confidence: parsed.confidence,
        schema_version: "claude-1",
        model: response.model,
        engine: "claude",
        latency_ms: Date.now() - started,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code =
        err instanceof Anthropic.RateLimitError ? "CLAUDE_RATE_LIMITED"
        : err instanceof Anthropic.AuthenticationError ? "CLAUDE_AUTH_ERROR"
        : err instanceof Anthropic.APIError ? "CLAUDE_API_ERROR"
        : err instanceof SyntaxError ? "CLAUDE_BAD_JSON"
        : "CLAUDE_NETWORK_ERROR";
      return errorResult(params.requestId, code, message);
    }
  }
}

function buildUserText(params: RefinePromptParams): string {
  return [
    `Request metadata:`,
    `- request_id: ${params.requestId}`,
    `- target_type: ${params.targetType}`,
    `- asset_type: ${params.assetType ?? "none"}`,
    `- locale: ${params.locale ?? "ko"}`,
    `- style_preset: ${params.stylePreset ?? "default"}`,
    ``,
    `Original user prompt:`,
    params.userPrompt,
    ``,
    `Task:`,
    `Analyze the attached image and the original user prompt, then return the JSON object.`,
    `If the image is ambiguous, describe the most likely simple shape and add a warning.`,
    `If the prompt conflicts with the image, preserve the user's intent but keep visible image traits.`,
  ].join("\n");
}

function errorResult(requestId: string, code: string, message: string): RefinePromptResult {
  return { ok: false, request_id: requestId, error: { code, message } };
}

/** 파일명 확장자 → 이미지 MIME. 알 수 없으면 PNG로 간주(파이프라인 내부는 항상 PNG). */
function mimeFromFilename(name?: string): "image/png" | "image/jpeg" | "image/webp" {
  const ext = (name ?? "").toLowerCase().split(".").pop();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}
