// 생성 해상도 유도 — 최종 타일 픽셀 크기(가로/세로) 대비 항상 배수로 키워서 생성한다.
// 그대로(1:1) 생성하면 품질이 급락한다는 게 실측 결론(ai-pipeline.md) — 이 배수를 타일 수와
// 무관하게 "긴 변 고정값"으로 잡으면, 타일이 많은(=최종 해상도가 이미 큰) 에셋은 업스케일
// 여유가 0에 가까워지므로 안 된다. 그래서 고정값이 아니라 "최종 크기 × upscaleFactor"로 유도한다.
import { TILE_PX } from "shared";
import { pipelineConfig } from "../config/index.js";

export interface GenResolution {
  width: number;
  height: number;
}

function roundToMultiple(value: number, multiple: number): number {
  return Math.max(multiple, Math.round(value / multiple) * multiple);
}

export function resolveGenResolution(tilesW: number, tilesH: number): GenResolution {
  const cfg = pipelineConfig.generation.resolution;

  const finalW = tilesW * TILE_PX;
  const finalH = tilesH * TILE_PX;
  const finalLong = Math.max(finalW, finalH);
  const aspect = finalW / finalH;

  // 배수 적용 후, 너무 작은 에셋은 minGenLongPx로 바닥을, 너무 큰 에셋은 maxGenLongPx로 상한을 둔다.
  const targetLong = Math.min(Math.max(finalLong * cfg.upscaleFactor, cfg.minGenLongPx), cfg.maxGenLongPx);

  let width = aspect >= 1 ? targetLong : targetLong * aspect;
  let height = aspect >= 1 ? targetLong / aspect : targetLong;

  width = roundToMultiple(width, cfg.roundToMultiple);
  height = roundToMultiple(height, cfg.roundToMultiple);
  width = Math.max(width, cfg.minSidePx);
  height = Math.max(height, cfg.minSidePx);

  return { width, height };
}
