// Stage 5e — 스케일 정규화. idle 클립의 bbox 높이 중앙값을 "기준 키"로, 전 액션·전 프레임을 이 기준에
// 맞춘다. 단 완전 스냅이 아니라 ±clamp 밴드 안이면 그대로 두고, 벗어난 프레임만 밴드 경계까지만 당긴다
// (숨쉬기 등 정상 변화 보존). 기준 키는 오케스트레이터가 scratch("referenceKeyHeight")로 주입 —
// 없으면 이 액션 자신의 중앙값으로 self-normalize(k≈1). 앵커(발 위치)를 고정한 채 스케일한다.
import { Stage } from "../pipeline/stage.js";
import type { BBox, PipelineContext, RgbaFrame } from "../pipeline/types.js";
import { BBOX_SCRATCH_KEY } from "./bbox.js";
import { pipelineConfig } from "../config/index.js";

export const REFERENCE_HEIGHT_SCRATCH_KEY = "referenceKeyHeight";

export class ScaleNormalizeStage implements Stage {
  readonly name = "scale-normalize";

  run(ctx: PipelineContext): void {
    const boxes = ctx.scratch.get(BBOX_SCRATCH_KEY) as BBox[] | undefined;
    if (!boxes) throw new Error("scale-normalize requires bbox stage first");

    const clamp = pipelineConfig.scaleNormalization.perFrameClampRatio;
    const lerp = pipelineConfig.scaleNormalization.lerp;
    const heights = boxes.map((b) => b.maxY - b.minY + 1);
    const reference = (ctx.scratch.get(REFERENCE_HEIGHT_SCRATCH_KEY) as number | undefined) ?? median(heights);

    const lo = reference * (1 - clamp);
    const hi = reference * (1 + clamp);
    const baselineRatio = pipelineConfig.anchor.baselineYRatio;

    for (let i = 0; i < ctx.frames.length; i++) {
      const h = heights[i];
      // 밴드 경계까지의 목표 배율을 구한 뒤, lerp 비율만큼만 접근(완전 스냅 아님 — 급격한 크기 튐 완화).
      let kTarget = 1;
      if (h > hi) kTarget = hi / h;
      else if (h < lo) kTarget = lo / h;
      const k = 1 + lerp * (kTarget - 1);
      if (k === 1) continue;

      const frame = ctx.frames[i];
      const ax = frame.width / 2;
      const ay = frame.height * baselineRatio;
      ctx.frames[i] = scaleAboutAnchor(frame, k, ax, ay);
    }
    ctx.log.info("scale-normalize done", { reference: Math.round(reference), clamp });
  }
}

/** 앵커점 (ax,ay)를 고정한 채 배율 k로 스케일 — dest→src 역매핑 + nearest 샘플 */
function scaleAboutAnchor(frame: RgbaFrame, k: number, ax: number, ay: number): RgbaFrame {
  const { width, height, data } = frame;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.round(ay + (y - ay) / k);
    if (sy < 0 || sy >= height) continue;
    for (let x = 0; x < width; x++) {
      const sx = Math.round(ax + (x - ax) / k);
      if (sx < 0 || sx >= width) continue;
      const s = (sy * width + sx) * 4;
      const d = (y * width + x) * 4;
      out[d] = data[s];
      out[d + 1] = data[s + 1];
      out[d + 2] = data[s + 2];
      out[d + 3] = data[s + 3];
    }
  }
  return { width, height, data: out };
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** idle 등 기준 액션의 프레임 bbox 높이 중앙값 — 오케스트레이터가 기준 키 계산에 사용 */
export function medianBBoxHeight(boxes: BBox[]): number {
  return median(boxes.map((b) => b.maxY - b.minY + 1));
}
