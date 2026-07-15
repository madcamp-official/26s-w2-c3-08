// Stage 5a(크로마키 제거) + 5b(실패 판정).
// 픽셀 로직(테두리 중앙값 추정·flood fill·디스필)은 shared/imaging으로 추출 — 서버의 업로드
// 소스 배경 분리와 동일 구현을 공유한다. 이 파일은 프레임 순회·회수(reclaim)·실패 판정만 담당.
import { Stage, StageFailure } from "../pipeline/stage.js";
import type { PipelineContext, RgbaFrame } from "../pipeline/types.js";
import {
  estimateBorderColor,
  floodFillRemove,
  despill,
  residualOpaqueBorderRatio,
  rgbDistanceNorm,
  type Rgb,
} from "shared/imaging";
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

    // 사전(pre-hoc) 분산 체크는 테두리 밴드가 얇아(기본 4px) 안쪽 배경 노이즈를 놓칠 수 있다
    // (실측: Wan이 가끔 배경 전체가 얼룩진 프레임을 내는데 테두리 몇 픽셀만은 우연히 깨끗함).
    // 그래서 flood fill 이후 "테두리에 배경이 실제로 남아있는가"를 직접 재검증(사후 검증)하고,
    // 실패한 프레임은 전체를 죽이지 않고 그 프레임만 최종 시트에서 제외한다.
    const keep: RgbaFrame[] = [];
    let preHocSuspicious = 0;
    let dropped = 0;

    for (const frame of ctx.frames) {
      const { color: bg, varianceNorm } = estimateBorderColor(frame, cfg.borderBandPx);
      if (varianceNorm > cfg.failVarianceThreshold) preHocSuspicious++;
      floodFillRemove(frame, bg, cfg.colorDistanceThreshold);
      if (reclaimOn) reclaimNearKey(frame, bg, reclaimThreshold);
      // 디스필 반경 = flood fill 매칭 임계값의 2배 — 배경과 "거의 같은" 잔상 픽셀만 잡고,
      // 그보다 훨씬 먼 core 캐릭터색(예: 청록 배경 위의 파란 옷)은 보존한다.
      if (cfg.despill) despill(frame, bg, cfg.colorDistanceThreshold * 2);

      const residual = residualOpaqueBorderRatio(frame, cfg.borderBandPx);
      if (residual > cfg.residualBorderOpaqueThreshold) {
        dropped++;
        continue; // 이 프레임은 keep에 안 넣음 — 최종 시트/루프선택에서 자동 제외
      }
      keep.push(frame);
    }

    const ratio = dropped / Math.max(1, ctx.frames.length);
    ctx.log.info("chromakey done", {
      frames: ctx.frames.length,
      preHocSuspicious,
      dropped,
      kept: keep.length,
      ratio: ratio.toFixed(2),
      reclaim: reclaimOn ? reclaimThreshold.toFixed(3) : "off",
    });
    if (ratio > cfg.failFrameRatio || keep.length === 0) {
      throw new StageFailure(this.name, "background not a stable solid color", { dropped, total: ctx.frames.length });
    }
    ctx.frames = keep;
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
