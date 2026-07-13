// Stage 5c — 프레임별 bbox. 배경 제거 후 알파 스캔으로 min/max 좌표.
// 노이즈 방어: 연결요소(불투명 픽셀 4-이웃)를 라벨링해, 전체 불투명 면적의 noiseCutoffRatio 미만인
// 작은 조각은 버리고 살아남은 요소들의 합집합으로 bbox를 잡는다(공중부양 큰 덩어리는 보존).
// 결과 bbox[]는 scratch("bbox")에 저장 — 앵커링·스케일 정규화가 참조.
import { Stage, StageFailure } from "../pipeline/stage.js";
import type { BBox, PipelineContext, RgbaFrame } from "../pipeline/types.js";
import { pipelineConfig } from "../config/index.js";

export const BBOX_SCRATCH_KEY = "bbox";

export class BBoxStage implements Stage {
  readonly name = "bbox";

  run(ctx: PipelineContext): void {
    const alphaT = pipelineConfig.bbox.alphaThreshold;
    const cutoff = pipelineConfig.bbox.noiseCutoffRatio;
    const boxes: BBox[] = [];

    for (let i = 0; i < ctx.frames.length; i++) {
      const box = computeBBox(ctx.frames[i], alphaT, cutoff);
      if (!box) {
        throw new StageFailure(this.name, "frame has no opaque content after keying", { frameIndex: i });
      }
      boxes.push(box);
    }

    ctx.scratch.set(BBOX_SCRATCH_KEY, boxes);
    ctx.log.info("bbox done", { frames: boxes.length });
  }
}

export function computeBBox(frame: RgbaFrame, alphaThreshold: number, noiseCutoffRatio: number): BBox | null {
  const { data, width, height } = frame;
  const n = width * height;
  const opaque = new Uint8Array(n);
  let totalOpaque = 0;
  for (let p = 0; p < n; p++) {
    if (data[p * 4 + 3] > alphaThreshold) {
      opaque[p] = 1;
      totalOpaque++;
    }
  }
  if (totalOpaque === 0) return null;

  // 연결요소 라벨링 (4-이웃 BFS)
  const label = new Int32Array(n).fill(-1);
  const compArea: number[] = [];
  const compBox: BBox[] = [];
  const stack: number[] = [];

  for (let start = 0; start < n; start++) {
    if (!opaque[start] || label[start] !== -1) continue;
    const id = compArea.length;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop() as number;
      const x = p % width;
      const y = (p - x) / width;
      area++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      const neigh = [x + 1 < width ? p + 1 : -1, x - 1 >= 0 ? p - 1 : -1, y + 1 < height ? p + width : -1, y - 1 >= 0 ? p - width : -1];
      for (const np of neigh) {
        if (np >= 0 && opaque[np] && label[np] === -1) {
          label[np] = id;
          stack.push(np);
        }
      }
    }
    compArea.push(area);
    compBox.push({ minX, minY, maxX, maxY });
  }

  // 컷오프 이상인 요소만 합집합
  const minArea = totalOpaque * noiseCutoffRatio;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let kept = 0;
  for (let i = 0; i < compArea.length; i++) {
    if (compArea[i] < minArea) continue;
    kept++;
    const b = compBox[i];
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  // 전부 컷오프 미만이면(작은 조각만 존재) 가장 큰 요소 하나라도 채택
  if (kept === 0) {
    let biggest = 0;
    for (let i = 1; i < compArea.length; i++) if (compArea[i] > compArea[biggest]) biggest = i;
    return compBox[biggest];
  }
  return { minX, minY, maxX, maxY };
}
