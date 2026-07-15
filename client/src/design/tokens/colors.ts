// UI 테마 색 (screen-design.md "UI 테마" 확정값). 화면 코드에 hex 하드코딩 금지 — 여기서만.
export const COLORS = {
  buildYellow: "#F6BE00",   // 주역: 타이틀 밴드·주요 버튼·활성 상태
  skyBlue: "#4A9DE0",       // 배경(수직 그라데이션)
  marioRed: "#E52521",      // 포인트: 위험 액션·강조 숫자
  terrainGreen: "#43A047",  // 보조
  dirtBrown: "#8B5A2B",     // 보조
} as const;

export const TILE_OVERLAY = "rgba(255,255,255,0.08)";
