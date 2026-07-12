import { env, requireQwenToken } from "../config/env.js";
import {
  qwenErrorSchema,
  qwenRefineInputSchema,
  qwenRefineSuccessSchema,
  type QwenRefineInput,
  type QwenRefineSuccess
} from "../schemas/qwenSchemas.js";

export class QwenClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly responseBody?: unknown
  ) {
    super(message);
    this.name = "QwenClientError";
  }

  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status === 500 || this.status === 503;
  }
}

export class QwenClient {
  constructor(
    private readonly baseUrl = env.QWEN_BASE_URL,
    private readonly timeoutMs = env.QWEN_TIMEOUT_MS
  ) {}

  async health(): Promise<unknown> {
    return this.getJson("/health", false);
  }

  async model(): Promise<unknown> {
    return this.getJson("/v1/model", true);
  }

  async refinePrompt(input: QwenRefineInput): Promise<QwenRefineSuccess> {
    const parsedInput = qwenRefineInputSchema.parse(input);
    const form = new FormData();

    form.append("request_id", parsedInput.requestId);
    form.append("user_id", parsedInput.userId);
    form.append("target_type", parsedInput.targetType);
    form.append("user_prompt", parsedInput.userPrompt);
    form.append("locale", parsedInput.locale);
    form.append("style_preset", parsedInput.stylePreset);
    form.append("output_language", parsedInput.outputLanguage);

    if (parsedInput.assetType) {
      form.append("asset_type", parsedInput.assetType);
    }

    const imageBlob = new Blob([new Uint8Array(parsedInput.imageBuffer)], {
      type: parsedInput.imageMime
    });
    form.append("image", imageBlob, parsedInput.imageFilename);

    const body = await this.requestJson("/v1/prompts/refine", {
      method: "POST",
      headers: {
        "X-Internal-Token": requireQwenToken()
      },
      body: form
    });

    const parsed = qwenRefineSuccessSchema.safeParse(body);
    if (!parsed.success) {
      throw new QwenClientError(
        502,
        "QWEN_RESPONSE_INVALID",
        "Qwen success response did not match the expected schema",
        parsed.error.flatten()
      );
    }

    if (parsed.data.request_id !== parsedInput.requestId) {
      throw new QwenClientError(
        502,
        "QWEN_REQUEST_ID_MISMATCH",
        "Qwen response request_id did not match the backend job id",
        parsed.data
      );
    }

    return parsed.data;
  }

  private async getJson(path: string, withToken: boolean): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (withToken) {
      headers["X-Internal-Token"] = requireQwenToken();
    }

    return this.requestJson(path, { method: "GET", headers });
  }

  private async requestJson(path: string, init: RequestInit): Promise<unknown> {
    const url = new URL(path, this.baseUrl).toString();

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (error) {
      throw new QwenClientError(
        0,
        "QWEN_NETWORK_ERROR",
        error instanceof Error ? error.message : "Failed to reach Qwen server"
      );
    }

    const responseBody = await this.parseResponseBody(response);
    if (!response.ok) {
      const parsedError = qwenErrorSchema.safeParse(responseBody);
      const code = parsedError.success ? parsedError.data.error.code : `QWEN_HTTP_${response.status}`;
      const message = parsedError.success
        ? parsedError.data.error.message
        : `Qwen server returned HTTP ${response.status}`;

      throw new QwenClientError(response.status, code, message, responseBody);
    }

    return responseBody;
  }

  private async parseResponseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}
