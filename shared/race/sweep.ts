// 라인 파괴 스윕(§레이스 규칙): 첫 라인부터 50초마다 그 라인의 에셋을 파괴하고
// 시작·끝 깃발 기단을 잇는 땅으로 대체(제작자가 유리해지는 것 방지, 오르내림 라인도 통행 가능).
import type { Rect } from "../physics/terrain.js";
import { SOLID_ALL } from "../physics/terrain.js";

/** 시작→끝 깃발 기단 y를 타일 단위로 계단식 보간한 바닥 solid 목록 (병합 좌표) */
export function sweepGroundSolids(
  start: { x: number; y: number },
  end: { x: number; y: number },
  tileSize: number,
): Rect[] {
  const dx = end.x - start.x;
  if (dx <= 0) return [];
  const rects: Rect[] = [];
  for (let i = 0; i <= dx; i++) {
    const t = i / dx;
    const y = Math.round(start.y + (end.y - start.y) * t) + 1;   // 기단 행(깃발 아래)
    rects.push({ x: (start.x + i) * tileSize, y: y * tileSize, w: tileSize, h: tileSize, faces: SOLID_ALL });
  }
  return rects;
}
