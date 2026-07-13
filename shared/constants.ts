// 클라·서버 공유 상수. 프리셋(enum 문자열) → 실제 물리값 매핑은 여기서만 관리한다.
// (DB에는 프리셋 문자열만 저장 — docs/KJH/tech-stack.md 참조)

/** 인게임 1타일 픽셀 크기 (2026-07-10 확정: 64px) */
export const TILE_PX = 64;

/** 아바타 캔버스 규격: 1×2타일 */
export const AVATAR_CANVAS = { w: TILE_PX, h: TILE_PX * 2 };

/** 아바타 히트박스 키 자동 보정 범위 (1.3~1.95타일) */
export const AVATAR_HITBOX_H = { minPx: 83, maxPx: 125 };

/** 웅크리기: 히트박스 0.95타일 / 시각 1타일 */
export const CROUCH = { hitboxPx: Math.round(0.95 * TILE_PX), visualPx: TILE_PX };

/** 스프라이트 재생성 쿨타임 (액션별, ms) */
export const REGEN_COOLDOWN_MS = 5 * 60 * 1000;

// 프리셋(slow/normal/fast 등) → 물리값 매핑은 physics/tuning.json(TUNING)이 담당,
// 프리셋 enum 정의 자체는 schemas/presets.ts 참조 — 이 파일에 중복 두지 않음.
