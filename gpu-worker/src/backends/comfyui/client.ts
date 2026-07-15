// ComfyUI + Wan2.2 I2V 백엔드 — GenerationBackend 구현.
// 흐름: 시작이미지 업로드 → 워크플로우에 제목 기반 값 주입 → /prompt 큐잉 → /history 폴링 →
//        OUTPUT(SaveImage) 프레임들을 /view로 내려받아 RgbaFrame[]로 반환.
//
// ⚠️ 5080 실측 확인 필요 항목(추정으로 작성, 붙일 때 검증):
//   - /history 응답의 outputs[nodeId].images 구조 (filename/subfolder/type)
//   - WanImageToVideo length 제약 (Wan은 보통 4k+1) — roundWanLength로 잠정 처리
//   - LoadImage가 subfolder 없는 파일명만 받는지
import { pngToFrame } from "../../image/raster.js";
import type { RgbaFrame } from "../../pipeline/types.js";
import type { GenerationBackend, GenerationRequest } from "../types.js";
import { pipelineConfig } from "../../config/index.js";
import { fetchWithTimeout } from "../../net/fetchWithTimeout.js";
import {
  applyOverridesByTitle,
  findNodeIdByTitle,
  loadWorkflow,
  WF_TITLE,
  type ComfyWorkflow,
} from "./workflowTemplate.js";

interface ComfyImageRef {
  filename: string;
  subfolder: string;
  type: string;
}

export interface ComfyBackendOptions {
  /** 예: http://127.0.0.1:8188 (5080 로컬 ComfyUI) */
  baseUrl: string;
  /** /history 폴링 상한(ms). 초과 시 실패. */
  generateTimeoutMs?: number;
  /** 폴링 간격(ms) */
  pollIntervalMs?: number;
}

export class ComfyUIBackend implements GenerationBackend {
  readonly id = "comfyui-wan2.2-i2v";
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly pollMs: number;
  private readonly clientId = `gpu-worker-${Math.random().toString(36).slice(2, 10)}`;

  constructor(opts: ComfyBackendOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.timeoutMs = opts.generateTimeoutMs ?? 10 * 60_000;
    this.pollMs = opts.pollIntervalMs ?? 1500;
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/system_stats`, {}, pipelineConfig.network.comfyHealthTimeoutMs);
      if (!res.ok) return { ok: false, detail: `system_stats HTTP ${res.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }

  async generate(req: GenerationRequest): Promise<RgbaFrame[]> {
    const uploaded = await this.uploadImage(req.startImagePng);
    const wf = this.buildWorkflow(req, uploaded.name);
    const promptId = await this.queuePrompt(wf);
    const outputs = await this.waitForHistory(promptId);
    const images = this.extractOutputImages(wf, outputs);
    if (images.length === 0) throw new Error("comfyui: OUTPUT node produced no images");
    const frames: RgbaFrame[] = [];
    for (const img of images) {
      const png = await this.viewImage(img);
      frames.push(await pngToFrame(png));
    }
    return frames;
  }

  /** POST /upload/image (multipart) → 저장된 파일명 */
  private async uploadImage(png: Buffer): Promise<{ name: string; subfolder: string }> {
    const form = new FormData();
    form.set("image", new Blob([new Uint8Array(png)], { type: "image/png" }), `start_${Date.now()}.png`);
    form.set("overwrite", "true");
    const res = await fetchWithTimeout(
      `${this.baseUrl}/upload/image`,
      { method: "POST", body: form },
      pipelineConfig.network.comfyRequestTimeoutMs,
    );
    if (!res.ok) throw new Error(`comfyui upload/image HTTP ${res.status}: ${await safeText(res)}`);
    const body = (await res.json()) as { name: string; subfolder?: string };
    return { name: body.name, subfolder: body.subfolder ?? "" };
  }

  /** 제목 기반 주입으로 최종 워크플로우 조립 */
  private buildWorkflow(req: GenerationRequest, imageName: string): ComfyWorkflow {
    const model = pipelineConfig.generation.model;
    const seed = req.seed ?? Math.floor(Math.random() * 2_147_483_647);
    return applyOverridesByTitle(loadWorkflow(), {
      [WF_TITLE.inputImage]: { image: imageName },
      [WF_TITLE.positive]: { text: req.positivePrompt },
      [WF_TITLE.negative]: { text: req.negativePrompt },
      [WF_TITLE.videoSize]: { width: req.width, height: req.height, length: roundWanLength(req.frameCount) },
      [WF_TITLE.samplerHigh]: { noise_seed: seed, steps: model.steps, cfg: model.cfg },
      [WF_TITLE.samplerLow]: { noise_seed: seed, steps: model.steps, cfg: model.cfg },
      [WF_TITLE.unetHigh]: { unet_name: model.highNoiseCheckpoint },
      [WF_TITLE.unetLow]: { unet_name: model.lowNoiseCheckpoint },
      [WF_TITLE.loraHigh]: { lora_name: model.lightningLora.high },
      [WF_TITLE.loraLow]: { lora_name: model.lightningLora.low },
    });
  }

  /** POST /prompt → prompt_id. node_errors 있으면 즉시 실패. */
  private async queuePrompt(wf: ComfyWorkflow): Promise<string> {
    const res = await fetchWithTimeout(
      `${this.baseUrl}/prompt`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: wf, client_id: this.clientId }),
      },
      pipelineConfig.network.comfyRequestTimeoutMs,
    );
    if (!res.ok) throw new Error(`comfyui /prompt HTTP ${res.status}: ${await safeText(res)}`);
    const body = (await res.json()) as { prompt_id?: string; node_errors?: Record<string, unknown> };
    if (body.node_errors && Object.keys(body.node_errors).length > 0) {
      throw new Error(`comfyui workflow node_errors: ${JSON.stringify(body.node_errors)}`);
    }
    if (!body.prompt_id) throw new Error("comfyui /prompt returned no prompt_id");
    return body.prompt_id;
  }

  /** GET /history/{id} 폴링 → 해당 프롬프트의 outputs 맵 */
  private async waitForHistory(promptId: string): Promise<Record<string, { images?: ComfyImageRef[] }>> {
    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      const res = await fetchWithTimeout(
        `${this.baseUrl}/history/${promptId}`,
        {},
        pipelineConfig.network.comfyPollRequestTimeoutMs,
      );
      if (res.ok) {
        const hist = (await res.json()) as Record<string, HistoryEntry>;
        const entry = hist[promptId];
        if (entry) {
          const status = entry.status?.status_str;
          if (status === "error") {
            throw new Error(`comfyui generation error: ${JSON.stringify(entry.status?.messages ?? [])}`);
          }
          if (entry.outputs && Object.keys(entry.outputs).length > 0) return entry.outputs;
        }
      }
      await sleep(this.pollMs);
    }
    throw new Error(`comfyui: generation timed out after ${this.timeoutMs}ms (prompt ${promptId})`);
  }

  /** OUTPUT 제목 노드의 images만 추출 (여러 SaveImage가 있어도 우리 것만) */
  private extractOutputImages(
    wf: ComfyWorkflow,
    outputs: Record<string, { images?: ComfyImageRef[] }>,
  ): ComfyImageRef[] {
    const outId = findNodeIdByTitle(wf, WF_TITLE.output);
    if (outId && outputs[outId]?.images) return outputs[outId].images!;
    // 폴백: 제목 매칭 실패 시 images를 가진 첫 출력 노드 (5080 실측 시 제목 유지되면 위에서 잡힘)
    for (const node of Object.values(outputs)) {
      if (node.images && node.images.length > 0) return node.images;
    }
    return [];
  }

  /** GET /view?filename&subfolder&type → PNG 바이트 */
  private async viewImage(img: ComfyImageRef): Promise<Buffer> {
    const qs = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder, type: img.type });
    const res = await fetchWithTimeout(
      `${this.baseUrl}/view?${qs}`,
      {},
      pipelineConfig.network.comfyRequestTimeoutMs,
    );
    if (!res.ok) throw new Error(`comfyui /view HTTP ${res.status} for ${img.filename}`);
    return Buffer.from(await res.arrayBuffer());
  }
}

interface HistoryEntry {
  status?: { status_str?: string; messages?: unknown[] };
  outputs?: Record<string, { images?: ComfyImageRef[] }>;
}

/** Wan I2V는 length가 4k+1일 때 안정적(실측 통설) — 가장 가까운 4k+1로 맞춘다. 최소 5. */
function roundWanLength(frames: number): number {
  const k = Math.max(1, Math.round((frames - 1) / 4));
  return 4 * k + 1;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "<no body>";
  }
}
