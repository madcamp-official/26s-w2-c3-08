// Stage 5g — 최종 타일 픽셀 크기로 nearest 다운스케일. 생성은 크게(4배+) 했으니 여기서 64px 그리드로
// 줄인다. 미세 떨림이 다운스케일에 흡수되는 효과도 있음(ai-pipeline.md).
// 목표 크기는 원본 tilesW×tilesH가 아니라 사방 paddingTiles만큼 넓힌 크기 — 합성(Stage3)부터
// 여기까지 패딩된 캔버스를 "진짜 캔버스"로 다뤄 팔 휘두르기 등이 잘리지 않게 한다(2026-07-16).
import { Stage } from "../pipeline/stage.js";
import type { PipelineContext } from "../pipeline/types.js";
import { resizeNearest } from "../image/raster.js";
import { pipelineConfig } from "../config/index.js";

export class DownscaleStage implements Stage {
  readonly name = "downscale";

  async run(ctx: PipelineContext): Promise<void> {
    const tile = pipelineConfig.output.tilePx;
    const pad = pipelineConfig.generation.resolution.paddingTiles;
    const w = (ctx.job.tilesW + 2 * pad) * tile;
    const h = (ctx.job.tilesH + 2 * pad) * tile;
    ctx.frames = await Promise.all(ctx.frames.map((f) => resizeNearest(f, w, h)));
    ctx.log.info("downscale done", { w, h, frames: ctx.frames.length });
  }
}
