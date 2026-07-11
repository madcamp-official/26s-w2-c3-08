export type QwenRetryAction = "fail" | "retry" | "pending_retry";

export type QwenRetryPolicy = {
  action: QwenRetryAction;
  retryable: boolean;
  maxAttempts: number;
  retryAfterMs?: number;
};

const DEFAULT_PENDING_RETRY_AFTER_MS = 15_000;
const DEFAULT_RATE_LIMIT_RETRY_AFTER_MS = 5_000;

export class QwenConfigurationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "QwenConfigurationError";
  }
}

export class QwenClientError extends Error {
  public readonly retryPolicy: QwenRetryPolicy;

  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly responseBody?: unknown,
    retryAfterMs?: number
  ) {
    super(message);
    this.name = "QwenClientError";
    this.retryPolicy = getQwenRetryPolicy(status, retryAfterMs);
  }
}

export function getQwenRetryPolicy(status: number, retryAfterMs?: number): QwenRetryPolicy {
  switch (status) {
    case 0:
      return {
        action: "pending_retry",
        retryable: true,
        maxAttempts: 1,
        retryAfterMs: retryAfterMs ?? DEFAULT_PENDING_RETRY_AFTER_MS
      };
    case 400:
    case 401:
    case 413:
      return { action: "fail", retryable: false, maxAttempts: 1 };
    case 422:
      return { action: "retry", retryable: true, maxAttempts: 2 };
    case 429:
      return {
        action: "pending_retry",
        retryable: true,
        maxAttempts: 1,
        retryAfterMs: retryAfterMs ?? DEFAULT_RATE_LIMIT_RETRY_AFTER_MS
      };
    case 500:
      return { action: "retry", retryable: true, maxAttempts: 2 };
    case 503:
      return {
        action: "pending_retry",
        retryable: true,
        maxAttempts: 1,
        retryAfterMs: retryAfterMs ?? DEFAULT_PENDING_RETRY_AFTER_MS
      };
    default:
      if (status >= 500) {
        return { action: "retry", retryable: true, maxAttempts: 2 };
      }

      return { action: "fail", retryable: false, maxAttempts: 1 };
  }
}

export function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (!headerValue) {
    return undefined;
  }

  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const retryAt = Date.parse(headerValue);
  if (!Number.isNaN(retryAt)) {
    return Math.max(0, retryAt - Date.now());
  }

  return undefined;
}

export function isQwenConfigurationError(error: unknown): error is QwenConfigurationError {
  return error instanceof QwenConfigurationError;
}

export function isQwenClientError(error: unknown): error is QwenClientError {
  return error instanceof QwenClientError;
}
