// 맵 에디터 격자 계약 — 25×12 (2026-07-16 확정, 기존 40×20에서 축소).
// 라인 데이터는 타일 단위라 EDITOR_TILE_PX(렌더 해상도)와 무관하다 — 픽셀은 캔버스 렌더 전용.
// 좌표 규약: (0,0)=좌상단, y 아래로 증가. LineData(shared/maps/lineTypes)와 동일.
export const GRID_W = 25;
export const GRID_H = 12;

/** 캔버스 렌더 한 타일 픽셀(줌 1 기준). 저장 데이터엔 안 들어감. */
export const EDITOR_TILE_PX = 48;

export const tileKey = (x: number, y: number): string => `${x},${y}`;

export const inBounds = (x: number, y: number): boolean =>
  x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
