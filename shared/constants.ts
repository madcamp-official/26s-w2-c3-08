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

/**
 * 프리셋(enum 문자열) → 실제 물리값 매핑.
 * DB에는 프리셋 문자열만 저장(shared/schemas/presets.ts), 실측 값은 여기서만 관리 (asset-attributes.md 수치 정책).
 * ⚠️ 전부 밸런스 미조정 초기값 — 그레이박스 플레이 테스트로 튜닝 대상.
 */
export const PRESET = {
  /** 속도 (px/s) — slow/normal/fast */
  speed: { slow: 40, normal: 80, fast: 160 },
  /** 주기 (ms) — short/normal/long */
  period: { short: 1000, normal: 2000, long: 4000 },
  /** 감지 거리·반경 (px) — near/normal/far */
  range: { near: 2 * TILE_PX, normal: 4 * TILE_PX, far: 8 * TILE_PX },
  /** 반발·도약 초속 (px/s) — low/high */
  power: { low: 320, high: 640 },
} as const;

/**
 * 접촉 반응(도넛 블록류) 고정 상수 — asset-attributes.md §1: 옵션 아님, 항상 재생.
 * ⚠️ 문서 내 모순: 서두 수치 정책은 "재생 3초", §1 표는 "5초 후 재생" — 표 값(5초) 채택, 팀 확정 필요.
 */
export const CONTACT_REACTION = { delayMs: 2000, respawnMs: 5000 } as const;
