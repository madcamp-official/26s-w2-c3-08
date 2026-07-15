// 백엔드 큐 pull 클라이언트 (워커 → 백엔드, 전부 아웃바운드라 NAT 안전).
// 계약: server/src/worker-api/routes.ts
//   GET  /api/ai/jobs/next            → 204(없음) | JobPayload
//   POST /api/ai/jobs/:id/result      → 시트 PNG(raw, image/png) + ?frameCount&frameW&frameH
//   POST /api/ai/jobs/:id/fail        → { errorMsg }
import type { Category } from "shared/schemas";
import { fetchWithTimeout } from "../net/fetchWithTimeout.js";
import { pipelineConfig } from "../config/index.js";

/** /api/ai/jobs/next 페이로드 (routes.ts buildJobPayload와 1:1). */
export interface JobPayload {
  jobId: string;
  assetId: string;
  name: string;
  action: string;
  sourceImageUrl: string;
  category: Category;
  tilesW: number;
  tilesH: number;
  /** 백엔드가 미리 채운 외형 프롬프트(있으면 LLM 스킵). 골격 단계에선 null. */
  prompt: string | null;
  motionHint: string;
  loop: boolean;
  returnsToStart: boolean;
  durationSec: number | null;
  poseHint: string | null;
  negativeExtra: string[];
}

export interface SheetMeta {
  frameCount: number;
  frameW: number;
  frameH: number;
}

export class ServerClient {
  private readonly baseUrl: string;
  constructor(
    baseUrl: string,
    private readonly workerToken: string | undefined,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private authHeaders(): Record<string, string> {
    return this.workerToken ? { "x-worker-token": this.workerToken } : {};
  }

  /** 다음 잡 claim. 큐가 비면 null. */
  async claimNext(): Promise<JobPayload | null> {
    const res = await fetchWithTimeout(
      `${this.baseUrl}/api/ai/jobs/next`,
      { headers: this.authHeaders() },
      pipelineConfig.network.serverRequestTimeoutMs,
    );
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`jobs/next HTTP ${res.status}: ${await safeText(res)}`);
    return (await res.json()) as JobPayload;
  }

  /** 원본 그림 다운로드. 상대 URL은 baseUrl 기준으로 해석. */
  async fetchSourceImage(sourceImageUrl: string): Promise<Buffer> {
    const url = /^https?:\/\//i.test(sourceImageUrl)
      ? sourceImageUrl
      : new URL(sourceImageUrl, `${this.baseUrl}/`).toString();
    const res = await fetchWithTimeout(url, {}, pipelineConfig.network.serverRequestTimeoutMs);
    if (!res.ok) throw new Error(`source image HTTP ${res.status}: ${url}`);
    return Buffer.from(await res.arrayBuffer());
  }

  /** 완성 시트 업로드 (raw image/png + 메타는 쿼리). */
  async postResult(jobId: string, sheetPng: Buffer, meta: SheetMeta): Promise<void> {
    const qs = new URLSearchParams({
      frameCount: String(meta.frameCount),
      frameW: String(meta.frameW),
      frameH: String(meta.frameH),
    });
    const res = await fetchWithTimeout(
      `${this.baseUrl}/api/ai/jobs/${jobId}/result?${qs}`,
      { method: "POST", headers: { ...this.authHeaders(), "Content-Type": "image/png" }, body: new Uint8Array(sheetPng) },
      pipelineConfig.network.serverUploadTimeoutMs,
    );
    if (!res.ok) throw new Error(`jobs/${jobId}/result HTTP ${res.status}: ${await safeText(res)}`);
  }

  /** 실패 보고 (재큐 or failed는 백엔드가 판단). */
  async postFail(jobId: string, errorMsg: string): Promise<void> {
    const res = await fetchWithTimeout(
      `${this.baseUrl}/api/ai/jobs/${jobId}/fail`,
      {
        method: "POST",
        headers: { ...this.authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ errorMsg: errorMsg.slice(0, 500) }),
      },
      pipelineConfig.network.serverRequestTimeoutMs,
    );
    if (!res.ok) throw new Error(`jobs/${jobId}/fail HTTP ${res.status}: ${await safeText(res)}`);
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "<no body>";
  }
}
