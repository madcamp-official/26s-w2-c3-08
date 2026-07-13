// Stage 5d — 바닥-중앙 앵커링. 각 프레임의 bbox 하단-중앙점을 캔버스의 고정 좌표
// (가로 중앙, 세로 baselineYRatio 지점)로 스냅(정수 이동). 모든 프레임·모든 액션이 같은 발 위치를
// 공유하게 되어 전진 걷기가 제자리걸음으로 교정되고 세로 들썩임이 사라진다.
// bbox scratch도 같은 오프셋으로 갱신해 뒤 stage(스케일 정규화)가 일관되게 참조하도록 한다.
import { Stage } from "../pipeline/stage.js";
import type { BBox, PipelineContext, RgbaFrame } from "../pipeline/types.js";
import { BBOX_SCRATCH_KEY } from "./bbox.js";
import { pipelineConfig } from "../config/index.js";

export class AnchorStage implements Stage {
  readonly name = "anchor";

  run(ctx: PipelineContext): void {
    const boxes = ctx.scratch.get(BBOX_SCRATCH_KEY) as BBox[] | undefined;
    if (!boxes) throw new Error("anchor stage requires bbox stage to run first");

    const baselineRatio = pipelineConfig.anchor.baselineYRatio;
    const lerp = pipelineConfig.anchor.lerp;

    for (let i = 0; i < ctx.frames.length; i++) {
      const frame = ctx.frames[i];
      const box = boxes[i];
      const targetX = Math.round(frame.width / 2);
      const targetY = Math.round(frame.height * baselineRatio);
      const bottomCenterX = Math.round((box.minX + box.maxX) / 2);
      const bottomY = box.maxY;
      // 완전 스냅이 아니라 lerp 비율만큼만 당긴다 — 자연스러운 미세 흔들림 보존.
      const dx = Math.round(lerp * (targetX - bottomCenterX));
      const dy = Math.round(lerp * (targetY - bottomY));
      if (dx !== 0 || dy !== 0) {
        translateInPlace(frame, dx, dy);
        boxes[i] = { minX: box.minX + dx, minY: box.minY + dy, maxX: box.maxX + dx, maxY: box.maxY + dy };
      }
    }
    ctx.log.info("anchor done", { baselineRatio, lerp });
  }
}

/** 프레임을 (dx,dy) 평행이동, 노출된 영역은 투명. 새 버퍼로 만들어 in-place 교체 */
function translateInPlace(frame: RgbaFrame, dx: number, dy: number): void {
  const { width, height, data } = frame;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= height) continue;
    for (let x = 0; x < width; x++) {
      const sx = x - dx;
      if (sx < 0 || sx >= width) continue;
      const src = (sy * width + sx) * 4;
      const dst = (y * width + x) * 4;
      out[dst] = data[src];
      out[dst + 1] = data[src + 1];
      out[dst + 2] = data[src + 2];
      out[dst + 3] = data[src + 3];
    }
  }
  frame.data = out;
}
