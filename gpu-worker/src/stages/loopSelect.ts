// Stage 5f — 루프 구간 자동 선택 + 최종 프레임 리샘플.
// 프레임 간 유사도(pHash 해밍거리)로 "시작~끝이 가장 닮은" 부분 수열을 찾아 루프로 채택한 뒤,
// 그 구간을 output.frameCount 장으로 균등 리샘플한다. loop=false(1회성) 액션은 전체 구간을 그대로
// 리샘플만 한다(닫힌 루프를 강요하지 않음).
import { Stage } from "../pipeline/stage.js";
import type { PipelineContext, RgbaFrame } from "../pipeline/types.js";
import { pipelineConfig } from "../config/index.js";

export class LoopSelectStage implements Stage {
  readonly name = "loop-select";

  run(ctx: PipelineContext): void {
    const target = pipelineConfig.output.frameCount;
    // 정지 시작 이미지 → 목표 포즈 "전환" 구간(예: onair 초반, 아직 착지 상태) 제거.
    // 스킵 후 최소 1프레임은 남긴다(전부 스킵 대상이면 스킵 자체를 포기).
    const skip = Math.min(ctx.job.skipLeadFrames, Math.max(0, ctx.frames.length - 1));
    const frames = skip > 0 ? ctx.frames.slice(skip) : ctx.frames;
    if (skip > 0) ctx.log.info("loop-select skip lead frames", { skip, remaining: frames.length });
    if (frames.length <= 1) {
      ctx.frames = resampleEven(frames, target);
      return;
    }

    let start = 0;
    let end = frames.length - 1;

    if (ctx.job.loop && pipelineConfig.loopSelection.algorithm === "phash") {
      const hashes = frames.map(pHash);
      const win = bestLoopWindow(hashes);
      start = win.start;
      end = win.end;
      ctx.log.info("loop window", { start, end, of: frames.length, dist: win.dist });
    }

    const window = frames.slice(start, end + 1);
    ctx.frames = resampleEven(window, target);
  }
}

/** 구간 [start,end]에서 균등 간격으로 count개 프레임을 뽑음 */
function resampleEven(frames: RgbaFrame[], count: number): RgbaFrame[] {
  if (frames.length === 0) return frames;
  if (frames.length === count) return frames;
  const out: RgbaFrame[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const idx = Math.round(t * (frames.length - 1));
    out.push(frames[idx]);
  }
  return out;
}

/**
 * 시작·끝이 가장 닮은 루프 구간 탐색. 충분한 길이(전체의 절반 이상)를 유지하는 후보 중
 * 첫 프레임과 (끝+1)프레임의 pHash 거리가 최소인 구간을 고른다.
 */
function bestLoopWindow(hashes: bigint[]): { start: number; end: number; dist: number } {
  const n = hashes.length;
  const minLen = Math.max(2, Math.floor(n / 2));
  let best = { start: 0, end: n - 1, dist: Number.POSITIVE_INFINITY };
  for (let s = 0; s <= n - minLen; s++) {
    for (let e = s + minLen - 1; e < n; e++) {
      // 닫힌 루프 품질 = 끝 다음 프레임이 시작과 얼마나 닮았나 (마지막 구간이면 끝↔시작)
      const nextIdx = e + 1 < n ? e + 1 : s;
      const d = hamming(hashes[s], hashes[nextIdx]);
      if (d < best.dist) best = { start: s, end: e, dist: d };
    }
  }
  return best;
}

/** 8x8 평균 해시(aHash 계열, 여기선 pHash 근사) — 그레이스케일 축소 후 평균 기준 비트 */
function pHash(frame: RgbaFrame): bigint {
  const size = 8;
  const gray = downsampleGray(frame, size);
  let sum = 0;
  for (const g of gray) sum += g;
  const avg = sum / gray.length;
  let bits = 0n;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] >= avg) bits |= 1n << BigInt(i);
  }
  return bits;
}

function downsampleGray(frame: RgbaFrame, size: number): number[] {
  const { data, width, height } = frame;
  const out: number[] = new Array(size * size).fill(0);
  const counts: number[] = new Array(size * size).fill(0);
  for (let y = 0; y < height; y++) {
    const by = Math.min(size - 1, Math.floor((y / height) * size));
    for (let x = 0; x < width; x++) {
      const bx = Math.min(size - 1, Math.floor((x / width) * size));
      const o = (y * width + x) * 4;
      const a = data[o + 3] / 255;
      const lum = (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) * a; // 투명은 어둡게
      const bi = by * size + bx;
      out[bi] += lum;
      counts[bi]++;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = counts[i] ? out[i] / counts[i] : 0;
  return out;
}

function hamming(a: bigint, b: bigint): number {
  let x = a ^ b;
  let c = 0;
  while (x) {
    c += Number(x & 1n);
    x >>= 1n;
  }
  return c;
}
