import { ZodError } from "zod";

import { QwenClient } from "./qwenClient.js";
import {
  QwenConfigurationError,
  isQwenClientError,
  isQwenConfigurationError
} from "./qwenErrors.js";
import {
  qwenRefineJobPayloadSchema,
  type QwenRefineJobPayload,
  type QwenRefineSuccess
} from "./qwenSchemas.js";

export type QwenRefineWorkerSuccess = {
  status: "succeeded";
  jobId: string;
  userId: string;
  targetType: "avatar" | "asset";
  attempts: number;
  qwen: QwenRefineSuccess;
};

export type QwenRefineWorkerPending = {
  status: "pending_retry";
  jobId: string;
  userId: string;
  targetType: "avatar" | "asset";
  attempts: number;
  httpStatus: number;
  errorCode: string;
  errorMessage: string;
  retryAfterMs?: number;
};

export type QwenRefineWorkerFailed = {
  status: "failed";
  jobId: string;
  userId: string;
  targetType: "avatar" | "asset";
  attempts: number;
  httpStatus?: number;
  errorCode: string;
  errorMessage: string;
};

export type QwenRefineWorkerResult =
  | QwenRefineWorkerSuccess
  | QwenRefineWorkerPending
  | QwenRefineWorkerFailed;

export type QwenRefineWorkerOptions = {
  client?: QwenClient;
};

export async function refinePromptForQwenJob(
  payload: QwenRefineJobPayload,
  options: QwenRefineWorkerOptions = {}
): Promise<QwenRefineWorkerResult> {
  const parsedPayload = qwenRefineJobPayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return {
      status: "failed",
      jobId: safeString(payload?.jobId),
      userId: safeString(payload?.userId),
      targetType: payload?.targetType === "asset" ? "asset" : "avatar",
      attempts: 0,
      errorCode: "QWEN_JOB_PAYLOAD_INVALID",
      errorMessage: "Qwen refine job payload failed local validation"
    };
  }

  const job = parsedPayload.data;
  const client = options.client ?? new QwenClient();
  let attempts = 0;

  while (true) {
    attempts += 1;

    try {
      const qwen = await client.refinePrompt({
        requestId: job.jobId,
        userId: job.userId,
        targetType: job.targetType,
        userPrompt: job.userPrompt,
        assetType: job.assetType,
        locale: "ko-KR",
        stylePreset: "platformer_sprite",
        outputLanguage: "en",
        imageBuffer: job.imageBuffer,
        imageMime: job.imageMime,
        imageFilename: job.imageFilename
      });

      return {
        status: "succeeded",
        jobId: job.jobId,
        userId: job.userId,
        targetType: job.targetType,
        attempts,
        qwen
      };
    } catch (error) {
      if (shouldRetryImmediately(error, attempts)) {
        continue;
      }

      return toWorkerErrorResult(error, job, attempts);
    }
  }
}

function shouldRetryImmediately(error: unknown, attempts: number): boolean {
  if (!isQwenClientError(error)) {
    return false;
  }

  return (
    error.retryPolicy.action === "retry" &&
    attempts < error.retryPolicy.maxAttempts
  );
}

function toWorkerErrorResult(
  error: unknown,
  job: QwenRefineJobPayload,
  attempts: number
): QwenRefineWorkerPending | QwenRefineWorkerFailed {
  if (isQwenClientError(error)) {
    if (error.retryPolicy.action === "pending_retry") {
      return {
        status: "pending_retry",
        jobId: job.jobId,
        userId: job.userId,
        targetType: job.targetType,
        attempts,
        httpStatus: error.status,
        errorCode: error.code,
        errorMessage: error.message,
        retryAfterMs: error.retryPolicy.retryAfterMs
      };
    }

    return {
      status: "failed",
      jobId: job.jobId,
      userId: job.userId,
      targetType: job.targetType,
      attempts,
      httpStatus: error.status,
      errorCode: error.code,
      errorMessage: error.message
    };
  }

  if (isQwenConfigurationError(error)) {
    return failedFromError(job, attempts, error);
  }

  if (error instanceof ZodError) {
    return {
      status: "failed",
      jobId: job.jobId,
      userId: job.userId,
      targetType: job.targetType,
      attempts,
      errorCode: "QWEN_LOCAL_SCHEMA_INVALID",
      errorMessage: "Local Qwen schema validation failed"
    };
  }

  return {
    status: "failed",
    jobId: job.jobId,
    userId: job.userId,
    targetType: job.targetType,
    attempts,
    errorCode: "QWEN_WORKER_UNKNOWN_ERROR",
    errorMessage: error instanceof Error ? error.message : "Unknown Qwen worker error"
  };
}

function failedFromError(
  job: QwenRefineJobPayload,
  attempts: number,
  error: QwenConfigurationError
): QwenRefineWorkerFailed {
  return {
    status: "failed",
    jobId: job.jobId,
    userId: job.userId,
    targetType: job.targetType,
    attempts,
    errorCode: error.code,
    errorMessage: error.message
  };
}

function safeString(value: unknown): string {
  return typeof value === "string" && value.length > 0 ? value : "unknown";
}
