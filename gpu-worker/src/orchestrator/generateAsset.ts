// 오케스트레이터 — 잡 1건(에셋의 한 액션)을 시트까지 만든다 (방식 A).
//
// 100유저 병렬 전제의 3단 분리: GPU(ComfyUI)는 VRAM상 한 번에 1건이라 어차피 직렬이므로,
// 진짜 이득은 "GPU가 생성하는 동안 다음 잡의 CPU·네트워크 작업을 겹치는 것"이다.
//   prepare  — claim된 잡의 소스 다운로드 → Stage1 정규화(업로드 배경분리) → 키색·사지 판단 →
//              LLM 외형 → 프롬프트 조립 → 크로마 합성  (CPU/네트워크; 이전 잡의 GPU 생성과 병행)
//   generate — ComfyUI I2V (GPU; 전체 파이프라인의 직렬 병목)
//   finish   — Stage 5 후처리 → 시트 패킹  (CPU; 다음 잡의 GPU 생성과 병행. idle 키높이 캐시
//              순서 보존을 위해 호출측이 직렬 체인으로 실행)
// 루프 배선은 index.ts.
import type { Category } from "shared/schemas";
import { ACTIONS, type ActionName, type ActionSpec } from "shared/actions";
import { selectKeyColorFromPng } from "../chroma/selectKeyColor.js";
import { detectLimbsFromPng, type LimbDetection } from "../anatomy/detectLimbs.js";
import { normalizeSource, NormalizationError } from "../normalize/normalizeSource.js";
import { compositeOnChroma } from "../image/composite.js";
import { resolveGenResolution, resolveGenDuration } from "../generation/index.js";
import { pipelineConfig } from "../config/index.js";
import { packSheet, type SpriteSheet } from "../output/packSheet.js";
import { Pipeline } from "../pipeline/runner.js";
import type { PipelineContext, StageLogger, AssetJob, RgbaFrame } from "../pipeline/types.js";
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
import { ServerClient, type JobPayload } from "../jobs/serverClient.js";

export interface OrchestratorDeps {
  backend: GenerationBackend;
  server: ServerClient;
  /** 없으면 외형을 스텁으로 채움(3090 없이 ComfyUI 검증용). */
  gateway?: PromptGatewayClient;
  log?: StageLogger;
}

/** prepare 산출물 — generate/finish가 재계산 없이 그대로 쓴다 */
export interface PreparedJob {
  job: JobPayload;
  /** Stage 1 정규화 완료된 투명 배경 소스 */
  sourcePng: Buffer;
  positive: string;
  negative: string;
  width: number;
  height: number;
  fps: number;
  genFrameCount: number;
  startImagePng: Buffer;
  chromaKeyHex: string;
  chromaMargin: number;
}

/** 정규화 소스 캐시 상한 — 같은 에셋 3잡(idle/walk/onair)은 인접 처리되므로 작아도 충분 */
const NORM_CACHE_MAX = 8;

export class Orchestrator {
  private readonly pipeline: Pipeline;
  private readonly appearanceCache = new Map<string, Appearance>();
  private readonly refHeightCache = new Map<string, number>();
  private readonly normCache = new Map<string, Buffer>();
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

  /**
   * CPU/네트워크 준비 단계. NormalizationError는 에셋 단위 실패로 승격(norm-fail)한 뒤 rethrow —
   * 같은 에셋의 다른 액션 잡들이 헛되이 GPU를 잡는 것을 막는다(3액션×3재시도 낭비 방지).
   */
  async prepare(job: JobPayload): Promise<PreparedJob> {
    const sourcePng = await this.getNormalizedSource(job);

    const chroma = await selectKeyColorFromPng(sourcePng);
    const limbs = await detectLimbsFromPng(sourcePng);
    const spec = ACTIONS[job.action as ActionName] as ActionSpec | undefined;
    const motionHint = stripAbsentLimbClauses(job.motionHint, spec, limbs);
    const limbNegativeExtra = [
      ...(limbs.hasArms ? [] : ["arms", "hands"]),
      ...(limbs.hasLegs ? [] : ["legs", "feet"]),
    ];
    this.log.info("limb detection", { job: job.jobId, hasArms: limbs.hasArms, hasLegs: limbs.hasLegs });

    const appearance = await this.getAppearance(job, sourcePng);
    const { positive, negative } = assemblePrompt(
      appearance,
      { motionHint, poseHint: job.poseHint, negativeExtra: [...(job.negativeExtra ?? []), ...limbNegativeExtra] },
      chroma.name,
    );
    // 실제 Wan에 들어가는 프롬프트 가시화 — 게이트웨이(Qwen) 품질 튜닝의 전제.
    this.log.info("wan prompt", { job: job.jobId, positive: truncate(positive, 220) });

    const res = resolveGenResolution(job.tilesW, job.tilesH);
    const dur = resolveGenDuration(job.action, job.loop);
    const genFrameCount = Math.max(1, Math.round(dur.durationSec * dur.fps));
    const startImagePng = await compositeOnChroma(sourcePng, chroma.hex, res.width, res.height);

    return {
      job,
      sourcePng,
      positive,
      negative,
      width: res.width,
      height: res.height,
      fps: dur.fps,
      genFrameCount,
      startImagePng,
      chromaKeyHex: chroma.hex,
      chromaMargin: chroma.rgbMargin,
    };
  }

  /** GPU 생성 단계 — 전체 처리량의 직렬 병목. 이 동안 다음 잡의 prepare가 병행된다. */
  async generate(prep: PreparedJob): Promise<RgbaFrame[]> {
    this.log.info("generating", {
      job: prep.job.jobId,
      action: prep.job.action,
      res: `${prep.width}x${prep.height}`,
      frames: prep.genFrameCount,
      chroma: prep.chromaKeyHex,
    });
    return this.deps.backend.generate({
      startImagePng: prep.startImagePng,
      width: prep.width,
      height: prep.height,
      frameCount: prep.genFrameCount,
      fps: prep.fps,
      positivePrompt: prep.positive,
      negativePrompt: prep.negative,
    });
  }

  /**
   * CPU 후처리 → 시트. idle 키높이 캐시(액션 간 크기 일관)가 실행 순서에 의존하므로
   * 호출측(index.ts)이 잡 순서대로 직렬 체인으로 실행한다 — GPU와는 병행되므로 손해 없음.
   */
  async finish(prep: PreparedJob, rawFrames: RgbaFrame[]): Promise<SpriteSheet> {
    const job = prep.job;
    const assetJob: AssetJob = {
      jobId: job.jobId,
      category: job.category as Category,
      action: job.action,
      loop: job.loop,
      tilesW: job.tilesW,
      tilesH: job.tilesH,
      sourceImagePng: prep.sourcePng,
      wanPrompt: prep.positive,
      wanNegativePrompt: prep.negative,
      chromaKeyHex: prep.chromaKeyHex,
      chromaMargin: prep.chromaMargin,
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

  /** Stage 1 — 소스 다운로드 + 정규화(에셋당 1회 캐시 + 서버 persist). */
  private async getNormalizedSource(job: JobPayload): Promise<Buffer> {
    const cached = this.normCache.get(job.assetId);
    if (cached) return cached;

    const raw = await this.deps.server.fetchSourceImage(job.sourceImageUrl);
    let png: Buffer;
    try {
      const norm = await normalizeSource(raw, job.sourceType, job.normPending);
      png = norm.png;
      if (norm.changed) {
        this.log.info("source normalized", { job: job.jobId, asset: job.assetId, bytes: png.length });
        // persist는 최적화(후속 잡·재생성이 매팅 반복 안 함) — 실패해도 이번 잡은 계속.
        try {
          await this.deps.server.postNormSource(job.assetId, png);
        } catch (e) {
          this.log.warn("norm-source persist failed (continuing)", { asset: job.assetId, err: errMsg(e) });
        }
      }
    } catch (e) {
      if (e instanceof NormalizationError) {
        this.log.warn("source normalization failed — failing whole asset", { asset: job.assetId, err: e.message });
        try {
          await this.deps.server.postNormFail(job.assetId, e.message);
        } catch (e2) {
          this.log.warn("norm-fail report failed", { asset: job.assetId, err: errMsg(e2) });
        }
      }
      throw e;
    }

    this.normCache.set(job.assetId, png);
    if (this.normCache.size > NORM_CACHE_MAX) {
      const oldest = this.normCache.keys().next().value as string;
      this.normCache.delete(oldest);
    }
    return png;
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

/**
 * 원본에 팔/다리가 없다고 판단되면(anatomy/detectLimbs) job.motionHint에서 그 clause를 뺀다.
 * 지금까지 모든 액션이 "arms swinging" 등을 무조건 요구해 사지 없는 캐릭터도 Wan이 팔다리를
 * 만들어내는 원인이었다 — spec의 clause 원문을 그대로 substring 제거하므로 오탐 없이 안전.
 * (server가 monster 속도별 override 문자열을 보낸 경우엔 clause가 애초에 없어 무해한 no-op.)
 */
function stripAbsentLimbClauses(motionHint: string, spec: ActionSpec | undefined, limbs: LimbDetection): string {
  let out = motionHint;
  if (spec?.motionHintArms && !limbs.hasArms) {
    out = out.replace(`, ${spec.motionHintArms}`, "").replace(spec.motionHintArms, "");
  }
  if (spec?.motionHintLegs && !limbs.hasLegs) {
    out = out.replace(`, ${spec.motionHintLegs}`, "").replace(spec.motionHintLegs, "");
  }
  return out;
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

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const consoleLogger: StageLogger = {
  info: (msg, extra) => console.log(`[orch] ${msg}`, extra ?? ""),
  warn: (msg, extra) => console.warn(`[orch] ${msg}`, extra ?? ""),
};
