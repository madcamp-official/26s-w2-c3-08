// qwen-prompt-server(/v1/prompts/refine) "받는 과정"만 구현 — 프롬프트 내용(system prompt, 액션/모션/
// 배경색 필드 확장)은 건드리지 않는다. 지금은 게이트웨이가 이미 지원하는 target_type("avatar"|"asset")과
// 자유 텍스트 user_prompt만 사용. 나중에 확장 시 이 클라이언트의 RefinePromptParams만 넓히면 됨.
import { ConcurrencyLimiter } from "./concurrencyLimiter.js";
import type { RefinePromptParams, RefinePromptResult } from "./types.js";

export interface GatewayConfig {
  /** 예: http://<3090-vm-host>:8001 */
  baseUrl: string;
  internalToken: string;
  /** 게이트웨이 QWEN_MAX_CONCURRENCY와 반드시 맞출 것 — 실측 전 잠정값은 index.ts 참조 */
  maxConcurrency: number;
  timeoutMs?: number;
  /** 429(GATEWAY_BUSY)·503(일시적 모델 미준비)에 한해서만 재시도 */
  maxRetries?: number;
  /** 재시도 지수백오프 기준 간격(ms) — 1회차 이 값, 2회차 2배... */
  retryBaseDelayMs?: number;
}

const RETRYABLE_CODES = new Set(["GATEWAY_BUSY", "MODEL_NOT_READY", "VLLM_UNAVAILABLE", "VLLM_TIMEOUT"]);

export class PromptGatewayClient {
  private readonly limiter: ConcurrencyLimiter;

  constructor(private readonly config: GatewayConfig) {
    this.limiter = new ConcurrencyLimiter(config.maxConcurrency);
  }

  async refine(params: RefinePromptParams): Promise<RefinePromptResult> {
    return this.limiter.run(() => this.requestWithRetry(params));
  }

  private async requestWithRetry(params: RefinePromptParams): Promise<RefinePromptResult> {
    const maxRetries = this.config.maxRetries ?? 2;
    let result: RefinePromptResult = { ok: false, request_id: params.requestId, error: { code: "UNREACHED", message: "no attempt made" } };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      result = await this.requestOnce(params);
      if (result.ok) return result;
      const retryable = RETRYABLE_CODES.has(result.error.code);
      if (!retryable || attempt === maxRetries) break;
      const base = this.config.retryBaseDelayMs ?? 500;
      await sleep(base * 2 ** attempt);
    }
    return result;
  }

  private async requestOnce(params: RefinePromptParams): Promise<RefinePromptResult> {
    const form = new FormData();
    form.set("request_id", params.requestId);
    form.set("user_id", params.userId);
    form.set("target_type", params.targetType);
    form.set("user_prompt", params.userPrompt);
    if (params.locale) form.set("locale", params.locale);
    if (params.stylePreset) form.set("style_preset", params.stylePreset);
    if (params.outputLanguage) form.set("output_language", params.outputLanguage);
    if (params.assetType) form.set("asset_type", params.assetType);
    // Buffer는 SharedArrayBuffer 백업 가능성 때문에 BlobPart 타입과 안 맞음 — 순수 Uint8Array로 복사.
    // MIME 타입을 반드시 지정 — 없으면 multipart가 application/octet-stream으로 나가 게이트웨이가
    // INVALID_IMAGE_TYPE로 반려한다(5080 실측으로 확인).
    const imageMime = mimeFromFilename(params.imageFilename);
    form.set("image", new Blob([new Uint8Array(params.image)], { type: imageMime }), params.imageFilename ?? "source.png");

    const timeoutMs = this.config.timeoutMs ?? 60_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.config.baseUrl}/v1/prompts/refine`, {
        method: "POST",
        headers: { "X-Internal-Token": this.config.internalToken },
        body: form,
        signal: controller.signal,
      });
      return (await res.json()) as RefinePromptResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = controller.signal.aborted ? "CLIENT_TIMEOUT" : "CLIENT_NETWORK_ERROR";
      return { ok: false, request_id: params.requestId, error: { code, message } };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 파일명 확장자 → 게이트웨이가 허용하는 이미지 MIME. 알 수 없으면 PNG로 간주. */
function mimeFromFilename(name?: string): string {
  const ext = (name ?? "").toLowerCase().split(".").pop();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}
