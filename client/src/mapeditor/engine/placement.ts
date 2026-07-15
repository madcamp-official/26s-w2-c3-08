// 배치·삭제·겹침 판정 (순수 로직, 렌더/스토어 무관 — 단위 테스트 쉽게).
// 다중타일 에셋은 차지하는 타일 전부를 검사한다(스펙: "앵커 하나가 아니라 차지 타일 전부").
import { tileKey, inBounds } from "./grid.js";

/**
 * 배치 가능한 카테고리 — 2026-07-16 확정: 아이템도 맵에 직접 배치 가능.
 * ⚠️ 저장 API(server/src/api/lines.ts)·loadLine.ts는 아직 block/monster만 허용 —
 * item 저장·서버 반영은 별도 백엔드 변경 항목(§P1 스펙 3.4)으로 남아있음.
 */
export type PlaceCategory = "block" | "monster" | "item";

export interface PlacedItem {
  /** 로컬 uid(렌더/삭제용) */
  id: string;
  /** 저장 시 그대로 나감. 실 에셋이면 assetId 문자열, 더미면 카드 id */
  assetKey: string;
  category: PlaceCategory;
  /** 타일 크기 */
  w: number;
  h: number;
  /** 좌상단 타일 (LineData 규약) */
  x: number;
  y: number;
  flipX: boolean;
  /** 원본 그림(투명 배경 PNG, 서버 상대경로) — 있으면 캔버스에 실제 그림으로 렌더, 없으면 색 폴백 */
  sourceImageUrl?: string | null;
  /** patrol/ride 이동 끝점 (타일). 정적이면 생략 */
  endX?: number;
  endY?: number;
}

/** 좌하단 앵커(커서 타일) → 좌상단 타일. 스펙: 고스트는 "타일 좌측 하단 기준". */
export function anchorToTopLeft(anchorX: number, anchorY: number, h: number): { x: number; y: number } {
  return { x: anchorX, y: anchorY - h + 1 };
}

/** 좌상단(x,y)+크기(w,h)가 차지하는 타일 키 목록 */
export function footprint(x: number, y: number, w: number, h: number): string[] {
  const out: string[] = [];
  for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) out.push(tileKey(x + dx, y + dy));
  return out;
}

/** 배치물들이 점유한 타일 Set (exceptId 하나는 제외 — 자기 자신 이동 판정용) */
export function occupiedTiles(items: Iterable<PlacedItem>, exceptId?: string): Set<string> {
  const s = new Set<string>();
  for (const it of items) {
    if (it.id === exceptId) continue;
    for (const k of footprint(it.x, it.y, it.w, it.h)) s.add(k);
  }
  return s;
}

/** 모든 타일이 격자 안 && 미점유 && 금지구역 아님 */
export function canPlace(
  x: number, y: number, w: number, h: number,
  occupied: Set<string>, forbidden: Set<string>,
): boolean {
  for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) {
    const tx = x + dx, ty = y + dy;
    if (!inBounds(tx, ty)) return false;
    const k = tileKey(tx, ty);
    if (occupied.has(k) || forbidden.has(k)) return false;
  }
  return true;
}

/** 커서 타일 (tx,ty)를 덮고 있는 배치물 id (삭제·픽용). 뒤에 놓인(나중) 것 우선. 없으면 null */
export function itemAt(items: Iterable<PlacedItem>, tx: number, ty: number): string | null {
  let hit: string | null = null;
  for (const it of items) {
    if (tx >= it.x && tx < it.x + it.w && ty >= it.y && ty < it.y + it.h) hit = it.id;
  }
  return hit;
}
