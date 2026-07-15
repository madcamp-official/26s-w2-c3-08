// RaceRoom 메시지 계약 — 이름·페이로드를 한 곳에(클라 수동 미러 방지).
// 서버→클라의 페이즈·타이머는 메시지가 아니라 상태(phase/phaseEndsAt)로 동기화된다.

/** 클라 → 서버 */
export const RACE_MSG = {
  /** 방장 전용, lobby에서만: 게임 시작 (→ preview) */
  start: "start",
  /** 방장 전용, finished에서만: 로비로 되돌리기 */
  restart: "restart",
} as const;

/** joinOrCreate("race", options) 계약 */
export interface RaceJoinOptions {
  /** POST /api/session이 발급한 유저 토큰 (필수) */
  userToken: string;
  /** 방 생성자(첫 입장)만 의미: 방 설정 */
  name?: string;
  isPublic?: boolean;
  password?: string;
}
