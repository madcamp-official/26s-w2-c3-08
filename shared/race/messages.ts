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
  /** 간이 매칭 배차로 생성된 방 — 고정 라인 + 인원 다 차면 자동 시작 */
  quick?: boolean;
  /** quick: 이 인원이 모이면(또는 타임아웃) 자동 racing 시작 */
  autoStartSize?: number;
}

/** QuickHubRoom(간이 매칭 허브) 계약 */
export const QUICK_HUB_MSG = {
  /** 클라 → 허브: 전원 매칭·시작(비공개 콘솔) */
  start: "startstart",
  /** 클라 → 허브: 전원 대기 복귀 */
  stop: "stopstop",
  /** 허브 → 클라(개별): 이 좌석 예약으로 레이스 방에 합류하라 */
  goRace: "goRace",
  /** 허브 → 클라(broadcast): 대기 상태로 — 레이스 방에서 나와 허브로 복귀하라 */
  backToHub: "backToHub",
} as const;
export interface GoRacePayload { reservation: unknown }
/** presence 채널 — 허브 stop → 모든 quick 레이스 방 전파 */
export const QUICK_STOP_CHANNEL = "quick:stop";

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
