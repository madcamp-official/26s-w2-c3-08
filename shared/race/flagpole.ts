// 깃대(플래그폴) 계약 — 클라 연출(goalLock 슬라이드)과 서버 판정(골 확정)이 같은 수치·판정을 쓴다.
// 깃발 좌표는 MapLine 필드(startFlag/endFlag)에서 파생 — 깃발은 에셋이 아니라 라인 메타데이터(설계 확정).
// 좌표 규약: 깃발 타일 (x,y) = 깃발이 서 있는 빈 타일. 기단(3×1)은 그 아래 행(y+1).

export const FLAGPOLE = {
  /** 일반(라인 경계 체크포인트) 깃대 높이 */
  poleHeightTiles: 5,
  /** 병합맵의 진짜 시작·최종 골 깃대 — 길게(구분, 게임 규칙) */
  longPoleHeightTiles: 8,
  /** 판정 밴드 폭(타일) — 깃발 타일 중심 세로 밴드 */
  poleWidthTiles: 0.5,
  /** goalLock 하강 속도 (px/s) */
  slideSpeedPxs: 280,
  /** 깃발 아래 자동 기단 폭 (3×1, 깃발과 한 세트 — 게임 규칙) */
  baseWidthTiles: 3,
} as const;

export interface FlagpoleRect { x: number; y: number; w: number; h: number }

/** 깃발 타일 → 깃대 히트박스(px). long=병합맵 첫 시작/최종 골 */
export function flagpoleRect(flagTiles: { x: number; y: number }, tileSize: number, long = false): FlagpoleRect {
  const hTiles = long ? FLAGPOLE.longPoleHeightTiles : FLAGPOLE.poleHeightTiles;
  const w = FLAGPOLE.poleWidthTiles * tileSize;
  const cx = (flagTiles.x + 0.5) * tileSize;
  const bottom = (flagTiles.y + 1) * tileSize;   // 기단 윗면
  return { x: cx - w / 2, y: bottom - hTiles * tileSize, w, h: hTiles * tileSize };
}

/** 바닥-중앙 앵커 body(x,y=발, w,h)와 깃대 겹침 판정 — 클라·서버 공용 */
export function overlapsFlagpole(px: number, py: number, pw: number, ph: number, r: FlagpoleRect): boolean {
  return Math.abs(px - (r.x + r.w / 2)) < (pw + r.w) / 2 && py > r.y && py - ph < r.y + r.h;
}
