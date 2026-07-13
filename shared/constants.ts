// 클라·서버 공유 상수. 프리셋(enum 문자열) → 실제 물리값 매핑은 여기서만 관리한다.
// (DB에는 프리셋 문자열만 저장 — docs/KJH/tech-stack.md 참조)

/** 인게임 1타일 픽셀 크기 (2026-07-10 확정: 64px) */
export const TILE_PX = 64;

/** V2 아바타 편집 visible canvas 규격. */
export const AVATAR_VISIBLE_WIDTH = 256;
export const AVATAR_VISIBLE_HEIGHT = 512;
export const AVATAR_WORKSPACE_SCALE = 3;
export const AVATAR_WORKSPACE_WIDTH = AVATAR_VISIBLE_WIDTH * AVATAR_WORKSPACE_SCALE;
export const AVATAR_WORKSPACE_HEIGHT = AVATAR_VISIBLE_HEIGHT * AVATAR_WORKSPACE_SCALE;

/** V2 MVP 맵 에디터 logical board/snap 규격. */
export const EDITOR_BOARD_COLS = 24;
export const EDITOR_BOARD_ROWS = 10;
export const EDITOR_CELL_PX = 32;

/** 아바타 게임 스프라이트 규격: 1×2타일. V2 visible canvas와 구분한다. */
export const AVATAR_GAME_SPRITE_WIDTH = TILE_PX;
export const AVATAR_GAME_SPRITE_HEIGHT = TILE_PX * 2;

/** @deprecated Use AVATAR_GAME_SPRITE_WIDTH/HEIGHT for game sprite dimensions. */
export const AVATAR_CANVAS = { w: AVATAR_GAME_SPRITE_WIDTH, h: AVATAR_GAME_SPRITE_HEIGHT };

/** 아바타 히트박스 키 자동 보정 범위 (1.3~1.95타일) */
export const AVATAR_HITBOX_H = { minPx: 83, maxPx: 125 };

/** 웅크리기: 히트박스 0.95타일 / 시각 1타일 */
export const CROUCH = { hitboxPx: Math.round(0.95 * TILE_PX), visualPx: TILE_PX };

/** 스프라이트 재생성 쿨타임 (액션별, ms) */
export const SPRITE_REGEN_COOLDOWN_MS = 5 * 60 * 1000;

/** @deprecated Use SPRITE_REGEN_COOLDOWN_MS. */
export const REGEN_COOLDOWN_MS = SPRITE_REGEN_COOLDOWN_MS;

// TODO: 프리셋 → 물리값 매핑 (slow/normal/fast 등) — asset-attributes.md 확정분 반영
