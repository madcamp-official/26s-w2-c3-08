// Stage 5g — 최종 타일 픽셀 크기로 nearest 다운스케일. 생성은 크게(2배+) 했으니 여기서 64px 그리드로
// 줄인다. 미세 떨림이 다운스케일에 흡수되는 효과도 있음(ai-pipeline.md).
import { Stage } from "../pipeline/stage.js";
import type { PipelineContext } from "../pipeline/types.js";
import { resizeNearest } from "../image/raster.js";
import { pipelineConfig } from "../config/index.js";

export class DownscaleStage implements Stage {
  readonly name = "downscale";

  async run(ctx: PipelineContext): Promise<void> {
    const tile = pipelineConfig.output.tilePx;
    const w = ctx.job.tilesW * tile;
    const h = ctx.job.tilesH * tile;
    ctx.frames = await Promise.all(ctx.frames.map((f) => resizeNearest(f, w, h)));
    ctx.log.info("downscale done", { w, h, frames: ctx.frames.length });
  }
}
