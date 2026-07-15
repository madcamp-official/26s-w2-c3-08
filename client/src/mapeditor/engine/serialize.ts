// 에디터 배치 상태 → LineData(shared 계약). 저장 API·테스트 로컬시뮬이 이 형태를 공유한다.
// 새 계약을 만들지 않고 기존 LineData/validateLineData를 그대로 쓴다.
import { validateLineData, type LineData } from "shared/maps";
import { GRID_W } from "./grid.js";
import type { PlacedItem } from "./placement.js";
import type { FlagPos } from "./flags.js";

/**
 * 배치물·깃발 → LineData.
 * tileLength = 격자 폭(25) 고정 — 병합 시 라인들이 딱 맞물리게(mergeLines가 이 값만큼 이어붙임).
 */
export function toLineData(
  name: string,
  placements: Iterable<PlacedItem>,
  start: FlagPos,
  end: FlagPos,
): LineData {
  return {
    name,
    tileLength: GRID_W,
    startFlag: { x: start.x, y: start.y },
    endFlag: { x: end.x, y: end.y },
    placements: [...placements].map((p) => ({
      assetKey: p.assetKey,
      x: p.x,
      y: p.y,
      flipX: p.flipX || undefined,
      endX: p.endX,
      endY: p.endY,
    })),
  };
}

/** 저장 전 계약 검증(폭 상한·깃발 순서). null이면 통과. */
export function validateEditorLine(line: LineData): string | null {
  return validateLineData(line);
}
