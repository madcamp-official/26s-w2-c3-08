// RaceRoom 메시지 계약 — 이름·페이로드를 한 곳에(클라 수동 미러 방지).
// 서버→클라의 페이즈·타이머는 메시지가 아니라 상태(phase/phaseEndsAt)로 동기화된다.

/** 클라 → 서버 */
export const RACE_MSG = {
  /** 방장 전용, lobby에서만: 게임 시작 (→ preview) */
  start: "start",
  /** 방장 전용, finished에서만: 로비로 되돌리기 */
  restart: "restart",
  /** building 한정, 플레이어당 평생 1회: 제작시간 ±30초 (screen-design.md 시간조정 스펙) */
  adjustTime: "adjustTime",
} as const;
export interface AdjustTimePayload { direction: "add" | "reduce" }

/** 서버 → 클라(개별 send. timeAdjusted만 broadcast) */
export const RACE_S2C_MSG = {
  /** 본인 라인이 결손(테스트 미완료)이라 DB 랜덤 라인으로 대체됐음을 통지 */
  lineFallback: "lineFallback",
  /** 추락사 — 가장 최근 통과한 체크포인트(라인 시작 깃발) 좌표(px)로 리스폰하라 */
  respawnAt: "respawnAt",
  /** (broadcast) 누군가 시간조정 — 방 전체 토스트 "{nickname}님이 시간을 {…}하였습니다" */
  timeAdjusted: "timeAdjusted",
} as const;
export interface LineFallbackPayload {
  reason: "no_test_passed";
}
export interface RespawnAtPayload { x: number; y: number }
export interface TimeAdjustedPayload { nickname: string; direction: "add" | "reduce" }

// ── 테스트 룸(testline) — 자기 라인 혼자 검증 ──
/** 서버 → 클라(개별 send) */
export const TESTLINE_MSG = {
  /** 깃대 접촉 = 완주 확정(testPassedAt 기록됨) */
  testPassed: "testPassed",
  /** 추락사 — 이 좌표(px, 바닥-중앙)로 리스폰하라 */
  respawnAt: "respawnAt",
} as const;
export interface TestPassedPayload { lineId: string }
export interface RespawnAtPayload { x: number; y: number }

/** joinOrCreate("testline", options) 계약 */
export interface TestlineJoinOptions {
  userToken: string;
  lineId: string;
}

/** joinOrCreate("race", options) 계약 */
export interface RaceJoinOptions {
  /** POST /api/session이 발급한 유저 토큰 (필수) */
  userToken: string;
  /** 방 생성자(첫 입장)만 의미: 방 설정 */
  name?: string;
  isPublic?: boolean;
  password?: string;
}

/**
 * GET /api/rooms 응답 1건 — @colyseus/sdk 0.17엔 네이티브 방 목록 조회가 없어(getAvailableRooms 부재)
 * DB Room 테이블을 REST로 노출한다. colyseusRoomId로 joinById.
 */
export interface RoomListing {
  colyseusRoomId: string;
  code: string;
  name: string | null;
  hostNickname: string;
  isPublic: boolean;
  maxPlayers: number;
  memberCount: number;
  status: string;
  phaseStartedAt: string | null;
}
