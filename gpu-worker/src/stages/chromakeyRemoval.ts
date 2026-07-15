// Stage 5a(크로마키 제거) + 5b(실패 판정).
// 픽셀 로직(테두리 중앙값 추정·flood fill·디스필)은 shared/imaging으로 추출 — 서버의 업로드
// 소스 배경 분리와 동일 구현을 공유한다. 이 파일은 프레임 순회·회수(reclaim)·실패 판정만 담당.
import { Stage, StageFailure } from "../pipeline/stage.js";
import type { PipelineContext, RgbaFrame } from "../pipeline/types.js";
import { estimateBorderColor, floodFillRemove, despill, rgbDistanceNorm, type Rgb } from "shared/imaging";
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
