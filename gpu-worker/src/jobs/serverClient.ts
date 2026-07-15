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
  /** 파이프라인 입력 소스 — 정규화본이 있으면 서버가 그걸 내려줌 */
  sourceImageUrl: string;
  /** "drawn"(투명 보장) | "uploaded"(배경 분리 필요할 수 있음) */
  sourceType: "drawn" | "uploaded";
  /** true = uploaded인데 아직 정규화본이 없음 → 워커가 Stage 1에서 AI 매팅 수행 */
  normPending: boolean;
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
  /** 원본 raw 클립 시작에서 건너뛸 프레임 수(ActionSpec.skipLeadFrames) — 정지→목표포즈 전환 구간 제거용 */
  skipLeadFrames: number;
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

  /** AI 매팅으로 만든 정규화 소스 등록 — 같은 에셋의 후속 잡·재생성이 재사용 (실패해도 치명 아님). */
  async postNormSource(assetId: string, normPng: Buffer): Promise<void> {
    const res = await fetchWithTimeout(
      `${this.baseUrl}/api/ai/assets/${assetId}/norm-source`,
      { method: "POST", headers: { ...this.authHeaders(), "Content-Type": "image/png" }, body: new Uint8Array(normPng) },
      pipelineConfig.network.serverUploadTimeoutMs,
    );
    if (!res.ok) throw new Error(`assets/${assetId}/norm-source HTTP ${res.status}: ${await safeText(res)}`);
  }

  /** 소스 정규화 실패 — 에셋의 모든 잡을 한 번에 failed 처리(액션별 재시도 낭비 방지). */
  async postNormFail(assetId: string, errorMsg: string): Promise<void> {
    const res = await fetchWithTimeout(
      `${this.baseUrl}/api/ai/assets/${assetId}/norm-fail`,
      {
        method: "POST",
        headers: { ...this.authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ errorMsg: errorMsg.slice(0, 500) }),
      },
      pipelineConfig.network.serverRequestTimeoutMs,
    );
    if (!res.ok) throw new Error(`assets/${assetId}/norm-fail HTTP ${res.status}: ${await safeText(res)}`);
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
