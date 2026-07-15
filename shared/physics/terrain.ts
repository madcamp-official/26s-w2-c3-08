// 지형 데이터 타입 + 조회. 좌표계: 원점 = 바닥-중앙이 아니라 "월드 절대좌표"이며
// 지형 사각형은 좌상단(x,y)+크기(w,h)로 정의한다. (Body만 바닥-중앙 앵커 — body.ts 참조)

/** 어느 면이 막는가 (일방통행·반통과 표현) */
export interface Faces {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export const SOLID_ALL: Faces = { top: true, bottom: true, left: true, right: true };
export const SOLID_TOP: Faces = { top: true, bottom: false, left: false, right: false };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 생략 시 완전 충돌 */
  faces?: Faces;
}

/**
 * 경사면. (x,y,w,h) 바운딩. floor(바닥 경사): dir=1 오른쪽으로 올라감.
 * ceiling(천장 경사): 상승 모멘텀만 상쇄, 수평 유지 (§asset).
 */
export interface Slope {
  x: number;
  y: number;
  w: number;
  h: number;
  dir: 1 | -1;
  kind: "floor" | "ceiling";
  /** 대각선(밟는 면)은 항상 단단함. 나머지 두 면(높은 쪽 세로 벽·밑면)은 옵션 — 생략 시 둘 다 단단함(§2026-07-16). */
  faces?: { side?: boolean; bottom?: boolean };
}

export interface Terrain {
  solids: Rect[];
  slopes: Slope[];
}

export function facesOf(r: Rect): Faces {
  return r.faces ?? SOLID_ALL;
}

/** 바닥 경사의 표면 y (해당 x에서). 범위 밖이면 null */
export function slopeSurfaceY(s: Slope, x: number): number | null {
  if (x < s.x || x > s.x + s.w) return null;
  const u = (x - s.x) / s.w;
  return s.dir === 1 ? s.y + s.h * (1 - u) : s.y + s.h * u;
}

/** 단순 전체 순회 조회 (공간분할은 인터페이스 유지한 채 추후 교체) */
export function querySolids(t: Terrain, _x: number, _y: number, _w: number, _h: number): Rect[] {
  return t.solids;
}
export function querySlopes(t: Terrain): Slope[] {
  return t.slopes;
}
