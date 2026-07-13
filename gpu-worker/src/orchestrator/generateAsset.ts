// 오케스트레이터 — 잡 1건(에셋의 한 액션)을 시트까지 만든다 (방식 A).
//   외형(LLM 1회/에셋, 캐시) → 크로마키색 선택 → 프롬프트 조립 → 크로마 합성 →
//   ComfyUI I2V → Stage 5 파이프라인 → 시트 PNG.
// idle을 먼저 처리하면 그 키높이를 캐시해 같은 에셋의 다른 액션이 스케일 기준으로 재사용(단일 워커 순차 시).
import type { Category } from "shared/schemas";
import { selectKeyColorFromPng } from "../chroma/selectKeyColor.js";
import { compositeOnChroma } from "../image/composite.js";
import { resolveGenResolution, resolveGenDuration } from "../generation/index.js";
import { pipelineConfig } from "../config/index.js";
import { packSheet, type SpriteSheet } from "../output/packSheet.js";
import { Pipeline } from "../pipeline/runner.js";
import type { PipelineContext, StageLogger, AssetJob } from "../pipeline/types.js";
import {
  ChromakeyRemovalStage,
  BBoxStage,
  AnchorStage,
  ScaleNormalizeStage,
  LoopSelectStage,
  DownscaleStage,
  BBOX_SCRATCH_KEY,
  REFERENCE_HEIGHT_SCRATCH_KEY,
  medianBBoxHeight,
} from "../stages/index.js";
import type { BBox } from "../pipeline/types.js";
import type { GenerationBackend } from "../backends/types.js";
import { assemblePrompt, type Appearance } from "./assemblePrompt.js";
import { PromptGatewayClient } from "../llm/gatewayClient.js";
import type { JobPayload } from "../jobs/serverClient.js";

export interface OrchestratorDeps {
  backend: GenerationBackend;
  /** 없으면 외형을 스텁으로 채움(3090 없이 ComfyUI 검증용). */
  gateway?: PromptGatewayClient;
  log?: StageLogger;
}

export class Orchestrator {
  private readonly pipeline: Pipeline;
  private readonly appearanceCache = new Map<string, Appearance>();
  private readonly refHeightCache = new Map<string, number>();
  private readonly log: StageLogger;

  constructor(private readonly deps: OrchestratorDeps) {
    this.log = deps.log ?? consoleLogger;
    // Stage 5 순서 — 스테이지는 무상태(싱글턴 config만 읽음)라 잡마다 재사용.
    this.pipeline = new Pipeline([
      new ChromakeyRemovalStage(),
      new BBoxStage(),
      new AnchorStage(),
      new ScaleNormalizeStage(),
      new LoopSelectStage(),
      new DownscaleStage(),
    ]);
  }

  /** 잡 1건 처리 → 시트. 실패는 throw(상위 워커 루프가 fail 보고). */
  async run(job: JobPayload, sourcePng: Buffer): Promise<SpriteSheet> {
    const chroma = await selectKeyColorFromPng(sourcePng);
    const appearance = await this.getAppearance(job, sourcePng);
    const { positive, negative } = assemblePrompt(
      appearance,
      { motionHint: job.motionHint, poseHint: job.poseHint, negativeExtra: job.negativeExtra },
      chroma.name,
    );

    const res = resolveGenResolution(job.tilesW, job.tilesH);
    const dur = resolveGenDuration(job.action, job.loop);
    const genFrameCount = Math.max(1, Math.round(dur.durationSec * dur.fps));
    const startImagePng = await compositeOnChroma(sourcePng, chroma.hex, res.width, res.height);

    this.log.info("generating", {
      job: job.jobId, action: job.action, res: `${res.width}x${res.height}`,
      frames: genFrameCount, chroma: chroma.name,
    });

    const rawFrames = await this.deps.backend.generate({
      startImagePng, width: res.width, height: res.height,
      frameCount: genFrameCount, fps: dur.fps,
      positivePrompt: positive, negativePrompt: negative,
    });

    const assetJob: AssetJob = {
      jobId: job.jobId,
      category: job.category as Category,
      action: job.action,
      loop: job.loop,
      tilesW: job.tilesW,
      tilesH: job.tilesH,
      sourceImagePng: sourcePng,
      wanPrompt: positive,
      wanNegativePrompt: negative,
      chromaKeyHex: chroma.hex,
    };
    const ctx: PipelineContext = {
      job: assetJob, config: pipelineConfig, frames: rawFrames, scratch: new Map(), log: this.log,
    };

    // 같은 에셋의 idle 키높이가 있으면 스케일 기준으로 주입(액션 간 크기 일관). 없으면 self-normalize.
    const cachedRef = this.refHeightCache.get(job.assetId);
    if (job.action !== "idle" && cachedRef !== undefined) {
      ctx.scratch.set(REFERENCE_HEIGHT_SCRATCH_KEY, cachedRef);
    }

    const result = await this.pipeline.run(ctx);
    if (!result.ok) {
      throw new Error(`pipeline failed at ${result.failedStage}: ${result.reason}`);
    }

    // idle이면 이 에셋의 기준 키높이 캐시 (생성 해상도 기준 — 다른 액션도 같은 해상도).
    if (job.action === "idle") {
      const boxes = ctx.scratch.get(BBOX_SCRATCH_KEY) as BBox[] | undefined;
      if (boxes && boxes.length) this.refHeightCache.set(job.assetId, medianBBoxHeight(boxes));
    }

    return packSheet(ctx.frames);
  }

  /** 외형 프롬프트: 백엔드 제공 > 캐시 > LLM 게이트웨이 > 스텁. */
  private async getAppearance(job: JobPayload, sourcePng: Buffer): Promise<Appearance> {
    // 백엔드가 미리 채운 프롬프트가 있으면 그대로(네거티브는 baseNegative가 커버).
    if (job.prompt) return { wanPrompt: job.prompt, wanNegativePrompt: "" };

    const cached = this.appearanceCache.get(job.assetId);
    if (cached) return cached;

    let appearance: Appearance;
    if (this.deps.gateway) {
      const targetType = job.category === "avatar" ? "avatar" : "asset";
      const result = await this.deps.gateway.refine({
        requestId: `${job.assetId}-${job.action}`,
        userId: "gpu-worker",
        targetType,
        userPrompt: job.name || "game asset",
        image: sourcePng,
        assetType: targetType === "asset" ? categoryToAssetType(job.category) : undefined,
      });
      if (!result.ok) throw new Error(`LLM refine failed: ${result.error.code} ${result.error.message}`);
      appearance = { wanPrompt: result.wan_prompt, wanNegativePrompt: result.wan_negative_prompt };
    } else {
      // 3090 없이 ComfyUI 검증용 스텁 (임시방편입니다 — 게이트웨이 붙으면 위 경로).
      this.log.warn("no LLM gateway — using stub appearance", { job: job.jobId });
      appearance = {
        wanPrompt: `a ${job.name || "character"}, simple clean 2D platformer game sprite, bold readable silhouette, flat shading, crisp edges`,
        wanNegativePrompt: "",
      };
    }
    this.appearanceCache.set(job.assetId, appearance);
    return appearance;
  }
}

/** 카테고리 → Qwen asset_type (prompts.py 규칙과 맞춤). */
function categoryToAssetType(category: string): string {
  switch (category) {
    case "monster": return "ENEMY";
    case "platform": return "TERRAIN";
    case "obstacle": return "DEVICE";
    case "item": return "ITEM";
    case "background": return "BACKGROUND";
    default: return "DEVICE";
  }
}

const consoleLogger: StageLogger = {
  info: (msg, extra) => console.log(`[orch] ${msg}`, extra ?? ""),
  warn: (msg, extra) => console.warn(`[orch] ${msg}`, extra ?? ""),
};
