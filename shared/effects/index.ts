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
  // ── 2026-07-15 확장: 레이스 진행 ──
  "fall",      // 낙사/장외 사망 (die와 구분되는 추락형)
  "respawn",   // 체크포인트 리스폰 (spawnSparkle 이펙트와 짝)
  "sweepWarn", // 라인 파괴 스윕 임박 경고
  "sweepHit",  // 라인 파괴 굉음
  "whistle",   // 게임 종료 휘슬
  // ── 에디터(제작 페이즈) ──
  "place",     // 에셋 배치
  "erase",     // 에셋 삭제
  "pick",      // 에셋 집기/선택 (깃발·핸들 드래그 시작 겸용)
  "flip",      // 좌우반전
  "denied",    // 배치 불가/거부 버저 (UI 에러 겸용)
  "favAdd",    // 즐겨찾기 추가
  "favRemove", // 즐겨찾기 제거
  "timeWarn",  // 남은시간 경고 틱 (제작·레이스 공용)
  // ── UI 공통 ──
  "uiHover",   // 버튼 호버
  "uiClick",   // 버튼 클릭 (주요 액션)
  "uiBack",    // 뒤로/닫기
  "modalOpen", // 모달 열림
  "modalClose",// 모달 닫힘
  "toast",     // 토스트 알림
  "playerJoin",// 방에 플레이어 입장
  "playerLeave",// 방에서 플레이어 퇴장
  "assetReady",// 에셋 생성 완료 알림
  "assetFail", // 에셋 생성 실패 알림
  // ── 월드 옵션 (배선은 emit 통로 작업 후 — sfx-coverage-todo.md) ──
  "iceSkid",   // 얼음 진입 스킷
  "dashPad",   // 가속판 밟기
  "crumble",   // 붕괴 직전 경고 (contactReaction fall/break)
  "sizeDown",  // 아이템: 축소 (하강음)
  "score",     // 아이템: 점수
  // ── 잡기·던지기 (§30, 2026-07-15 추가 — 전 구간 무음이었음) ──
  "grab",         // 물체 집기 성공
  "grabDenied",   // 잡기 허공(대상 없음) 또는 서버 소유권 패배(거부)
  "projectileHit",// 발사체·던진 물체가 벽/바닥에 맞아 소멸 (터짐 없이 조용히 사라지던 것)
  "objectRespawn",// 잡기 파츠(돌 등)가 7.5초 후 원위치 재생성
] as const;
export type SoundName = (typeof SOUNDS)[number];
