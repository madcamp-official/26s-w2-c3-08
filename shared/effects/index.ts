// 공용 이펙트·사운드 이름 풀 (§57·§64). 구현은 클라 렌더 계층 — 여기는 계약(이름)만.
export const EFFECTS = [
  "dust",        // 달리기·벽타기·착지 먼지
  "explosion",
  "hitFlash",    // 피격
  "stunStars",   // 기절
  "poofDeath",   // 처치
  "spawnSparkle",// 재생성 페이드인
  "pickupGlow",  // 아이템 획득 하이라이트 (0.4초 고정 동안)
] as const;
export type EffectName = (typeof EFFECTS)[number];

export const SOUNDS = [
  "jump", "land", "stomp", "hurt", "die", "pickup", "switch", "break",
  "shoot", "hop", "charge", "teleport", "emerge", "enrage", "stun",
  "shell", "revive", "bump", "boing", "slam_start", "slam_hit", "throw",
  "aggro",     // 몬스터 추적 시작 (chase 진입)
  "flap",      // 비행 몬스터 이동 시작
  "crawl",     // 등반 몬스터 이동 시작
  "wallKick",  // 플레이어 벽점프
  "wallGrab",  // 플레이어 벽 잡기(클링 시작)
  "slide",     // 플레이어 경사 슬라이딩 시작
  "powerUp",   // 아이템: 강화형(sizeUp/hpUp) 획득
] as const;
export type SoundName = (typeof SOUNDS)[number];
