// 깃발 규칙 — 미리 배치된 시작/끝 깃발의 이동 제약 + 배치 금지구역.
// 좌표 규약: 깃발 (x,y) = 깃발이 서 있는 빈 타일. 기단 3×1은 아래 행(y+1). 깃대는 위로 5칸.
import { GRID_W, GRID_H, tileKey } from "./grid.js";
import { FLAGPOLE } from "shared/race";

export interface FlagPos { x: number; y: number }

/** 시작~골 최소 가로 거리(타일) — 2026-07-16 신규 규칙 */
export const MIN_FLAG_GAP_TILES = 5;

/**
 * 깃발 금지구역 타일 — 기단(3×1) + 그 위로 깃대 높이(5칸). 세로 총 6, 폭 3.
 * 다른 에셋을 이 타일들 위에 배치할 수 없다(깃발/깃대/기단과 겹침 방지).
 */
export function flagForbiddenTiles(flag: FlagPos): string[] {
  const half = Math.floor(FLAGPOLE.baseWidthTiles / 2); // 3 → 1
  const out: string[] = [];
  for (let dx = -half; dx <= half; dx++) {
    // 깃대: flag.y-(5-1) .. flag.y  (5칸)  +  기단: flag.y+1
    for (let ty = flag.y - (FLAGPOLE.poleHeightTiles - 1); ty <= flag.y + 1; ty++) {
      out.push(tileKey(flag.x + dx, ty));
    }
  }
  return out;
}

/** 두 깃발의 금지구역 합집합 */
export function bothFlagsForbidden(start: FlagPos, end: FlagPos): Set<string> {
  return new Set([...flagForbiddenTiles(start), ...flagForbiddenTiles(end)]);
}

/**
 * 깃발 이동 허용 여부. 규칙 위반이면 false → 호출부는 그냥 안 움직임(별도 에러 연출 없음, 스펙).
 * - 기단(폭3)이 좌우 벽을 넘지 않게 x ∈ [1, GRID_W-2]
 * - 깃대(위 5칸)·기단(아래 1칸)이 격자를 벗어나지 않게 y ∈ [poleHeight-1, GRID_H-2]
 * - 끝 깃발은 시작보다 왼쪽 불가 + 최소 거리(MIN_FLAG_GAP_TILES)
 */
export function canMoveFlag(which: "start" | "end", nx: number, ny: number, other: FlagPos): boolean {
  if (nx < 1 || nx > GRID_W - 2) return false;
  if (ny < FLAGPOLE.poleHeightTiles - 1 || ny > GRID_H - 2) return false;
  if (which === "end") return nx - other.x >= MIN_FLAG_GAP_TILES;
  return other.x - nx >= MIN_FLAG_GAP_TILES;
}
