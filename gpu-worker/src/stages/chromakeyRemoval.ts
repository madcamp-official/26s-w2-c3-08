// Stage 5a(크로마키 제거) + 5b(실패 판정).
// 프레임마다 독립적으로: 테두리 밴드의 중앙값 = 실제 배경색으로 재측정(드리프트·급변 대응) →
// 테두리에서 flood fill로 "배경색에 가깝고 배경과 연결된" 영역만 알파 제거(캐릭터 내부 유사색 보존) →
// (옵션) 디스필. 테두리 색 분산이 큰 프레임이 많으면 배경 붕괴로 보고 StageFailure(재생성 큐로).
import { Stage, StageFailure } from "../pipeline/stage.js";
import type { PipelineContext, RgbaFrame } from "../pipeline/types.js";
import { rgbDistanceNorm, type Rgb } from "../image/color.js";
import { pipelineConfig } from "../config/index.js";

export class ChromakeyRemovalStage implements Stage {
  readonly name = "chromakey-removal";

  run(ctx: PipelineContext): void {
    const cfg = pipelineConfig.chromaKey;
    // 갇힌-배경 회수: 테두리 플러드필은 "테두리와 연결된" 배경만 지우므로, 캐릭터에 둘러싸여
    // 갇힌 배경 주머니는 남는다. 키색이 캐릭터 색과 충분히 먼 경우(margin 게이트)에 한해,
    // 연결성 무관하게 키색에 가까운 픽셀을 추가 제거해 갇힌 주머니 + 경계 잔상을 함께 정리한다.
    // margin이 작은(색색) 캐릭터에선 자동 off되어 캐릭터를 갉아먹지 않는다.
    const reclaimOn = ctx.job.chromaMargin > cfg.enclosedReclaimMarginGate;
    const reclaimThreshold = Math.min(
      cfg.enclosedReclaimMaxThreshold,
      ctx.job.chromaMargin * cfg.enclosedReclaimMarginFrac,
    );
    let suspicious = 0;

    for (const frame of ctx.frames) {
      const { color: bg, varianceNorm } = estimateBorderColor(frame, cfg.borderBandPx);
      if (varianceNorm > cfg.failVarianceThreshold) suspicious++;
      floodFillRemove(frame, bg, cfg.colorDistanceThreshold);
      if (reclaimOn) reclaimNearKey(frame, bg, reclaimThreshold);
      if (cfg.despill) despill(frame, bg);
    }

    const ratio = suspicious / Math.max(1, ctx.frames.length);
    ctx.log.info("chromakey done", {
      frames: ctx.frames.length,
      suspicious,
      ratio: ratio.toFixed(2),
      reclaim: reclaimOn ? reclaimThreshold.toFixed(3) : "off",
    });
    if (ratio > cfg.failFrameRatio) {
      throw new StageFailure(this.name, "background not a stable solid color", { suspicious, total: ctx.frames.length });
    }
  }
}

/**
 * 연결성 무관하게, 배경색(bg=이 프레임 테두리 추정 키색)에 가까운 불투명 픽셀을 제거한다.
 * flood fill이 못 닿은 "갇힌 배경 주머니" + 경계에 남은 키색 잔상(프린지)을 함께 잡는다.
 * threshold는 margin에 비례해 정해지고(선택 코드에서 게이팅), 캐릭터 색은 키색과 멀어 보존된다.
 */
function reclaimNearKey(frame: RgbaFrame, bg: Rgb, threshold: number): void {
  const { data } = frame;
  for (let o = 0; o < data.length; o += 4) {
    if (data[o + 3] === 0) continue; // 이미 제거된 픽셀
    const d = rgbDistanceNorm({ r: data[o], g: data[o + 1], b: data[o + 2] }, bg);
    if (d <= threshold) data[o + 3] = 0;
  }
}

/** 테두리 밴드 픽셀들의 채널별 중앙값 = 배경색, 정규화 분산 = 단색 신뢰도 */
function estimateBorderColor(frame: RgbaFrame, band: number): { color: Rgb; varianceNorm: number } {
  const { data, width, height } = frame;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const onBorder = x < band || y < band || x >= width - band || y >= height - band;
      if (!onBorder) continue;
      const o = (y * width + x) * 4;
      rs.push(data[o]);
      gs.push(data[o + 1]);
      bs.push(data[o + 2]);
    }
  }
  const color = { r: median(rs), g: median(gs), b: median(bs) };
  const varianceNorm = (chanVar(rs) + chanVar(gs) + chanVar(bs)) / 3 / (255 * 255);
  return { color, varianceNorm };
}

/** 테두리에서 시작해 배경색에 가까운 연결 영역만 알파 0으로 (BFS) */
function floodFillRemove(frame: RgbaFrame, bg: Rgb, threshold: number): void {
  const { data, width, height } = frame;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const pushIfBg = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    const o = p * 4;
    const d = rgbDistanceNorm({ r: data[o], g: data[o + 1], b: data[o + 2] }, bg);
    if (d <= threshold) {
      data[o + 3] = 0; // 배경 → 투명
      queue.push(p);
    }
  };

  for (let x = 0; x < width; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfBg(0, y);
    pushIfBg(width - 1, y);
  }

  while (queue.length) {
    const p = queue.pop() as number;
    const x = p % width;
    const y = (p - x) / width;
    pushIfBg(x + 1, y);
    pushIfBg(x - 1, y);
    pushIfBg(x, y + 1);
    pushIfBg(x, y - 1);
  }
}

/** 남은 반투명 경계의 키색 기운 완화 — 각 픽셀에서 bg 방향 성분을 소폭 빼는 단순 디스필 */
function despill(frame: RgbaFrame, bg: Rgb): void {
  const { data } = frame;
  for (let o = 0; o < data.length; o += 4) {
    if (data[o + 3] === 0) continue;
    // bg가 지배적인 채널(예: 순녹이면 g)의 과한 값을 이웃 채널 최대치로 클램프해 기운을 뺀다
    if (bg.g > bg.r && bg.g > bg.b) data[o + 1] = Math.min(data[o + 1], Math.max(data[o], data[o + 2]));
    else if (bg.r > bg.g && bg.r > bg.b) data[o] = Math.min(data[o], Math.max(data[o + 1], data[o + 2]));
    else if (bg.b > bg.r && bg.b > bg.g) data[o + 2] = Math.min(data[o + 2], Math.max(data[o], data[o + 1]));
  }
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function chanVar(xs: number[]): number {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / xs.length;
}
