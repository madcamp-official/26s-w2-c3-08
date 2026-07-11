import {
  getQwenConfig,
  requireQwenApiToken,
  type QwenConfig
} from "./qwenConfig.js";
import {
  QwenClientError,
  parseRetryAfterMs
} from "./qwenErrors.js";
import {
  qwenErrorSchema,
  qwenHealthSchema,
  qwenModelSchema,
  qwenRefineInputSchema,
  qwenRefineSuccessSchema,
  type QwenHealth,
  type QwenModel,
  type QwenRefineInput,
  type QwenRefineSuccess
} from "./qwenSchemas.js";

export class QwenClient {
  constructor(private readonly config: QwenConfig = getQwenConfig()) {}

  async health(): Promise<QwenHealth> {
    const body = await this.requestJson("/health", { method: "GET" });
    const parsed = qwenHealthSchema.safeParse(body);
    if (!parsed.success) {
      throw new QwenClientError(
        502,
        "QWEN_HEALTH_RESPONSE_INVALID",
        "Qwen health response did not match the expected schema",
        parsed.error.flatten()
      );
    }

    return parsed.data;
  }

  async model(): Promise<QwenModel> {
    const body = await this.requestJson("/v1/model", {
      method: "GET",
      headers: {
        "X-Internal-Token": requireQwenApiToken(this.config)
      }
    });

    const parsed = qwenModelSchema.safeParse(body);
    if (!parsed.success) {
      throw new QwenClientError(
        502,
        "QWEN_MODEL_RESPONSE_INVALID",
        "Qwen model response did not match the expected schema",
        parsed.error.flatten()
      );
    }

    if (
      parsed.data.ok !== true ||
      parsed.data.vllm_ok !== true ||
      parsed.data.model_loaded !== true
    ) {
      throw new QwenClientError(
        503,
        parsed.data.vllm_error_code ?? "MODEL_NOT_READY",
        "Qwen model is not ready",
        parsed.data
      );
    }

    return parsed.data;
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
        "X-Internal-Token": requireQwenApiToken(this.config)
      },
      body: form
    });

    const parsed = qwenRefineSuccessSchema.safeParse(body);
    if (!parsed.success) {
      throw new QwenClientError(
        502,
        "QWEN_REFINE_RESPONSE_INVALID",
        "Qwen refine success response did not match the expected schema",
        parsed.error.flatten()
      );
    }

    if (parsed.data.request_id !== parsedInput.requestId) {
      throw new QwenClientError(
        502,
        "QWEN_REQUEST_ID_MISMATCH",
        "Qwen response request_id did not match the backend job id",
        {
          expected_request_id: parsedInput.requestId,
          actual_request_id: parsed.data.request_id
        }
      );
    }

    return parsed.data;
  }

  private async requestJson(path: string, init: RequestInit): Promise<unknown> {
    const url = new URL(path, `${this.config.baseUrl}/`).toString();

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(this.config.timeoutMs)
      });
    } catch (error) {
      throw new QwenClientError(
        0,
        isAbortLikeError(error) ? "QWEN_REQUEST_TIMEOUT" : "QWEN_NETWORK_ERROR",
        error instanceof Error ? error.message : "Failed to reach Qwen Gateway"
      );
    }

    const responseBody = await this.parseResponseBody(response);
    if (!response.ok) {
      const parsedError = qwenErrorSchema.safeParse(responseBody);
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      const code = parsedError.success ? parsedError.data.error.code : `QWEN_HTTP_${response.status}`;
      const message = parsedError.success
        ? parsedError.data.error.message
        : `Qwen Gateway returned HTTP ${response.status}`;

      throw new QwenClientError(response.status, code, message, responseBody, retryAfterMs);
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
      throw new QwenClientError(
        response.ok ? 502 : response.status,
        "QWEN_RESPONSE_NOT_JSON",
        "Qwen Gateway returned a non-JSON response"
      );
    }
  }
}

function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && (
    error.name === "AbortError" ||
    error.name === "TimeoutError"
  );
}
