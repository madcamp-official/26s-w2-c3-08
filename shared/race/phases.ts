// 레이스 방 페이즈 계약 — 클라(화면 분기·타이머 표시)와 서버(전이 엔진)가 공유.
// 타이머의 단일 원천은 서버가 정한 절대시각(state.phaseEndsAt, serverTime 기준) —
// 클라는 남은 시간만 계산하고, 시간 단축/추가도 서버가 이 값 하나를 조정한다.
import { GAME_RULES } from "../constants.js";

export const PHASES = ["lobby", "preview", "building", "racing", "finished"] as const;
export type Phase = (typeof PHASES)[number];

/** 자동 전이 순서. finished→lobby는 방장 restart 메시지로만 */
export const NEXT_PHASE: Partial<Record<Phase, Phase>> = {
  lobby: "preview",       // start 메시지로 진입 (자동 아님)
  preview: "building",
  building: "racing",
  racing: "finished",
};

/**
 * 페이즈 지속시간(초). null = 무제한(타이머 없음 — lobby·finished).
 * racing은 라인 수에 비례(lineCount × perLineSec).
 */
export function phaseDurationSec(phase: Phase, lineCount = 0): number | null {
  switch (phase) {
    case "preview": return GAME_RULES.previewSec;
    case "building": return GAME_RULES.buildSec;
    case "racing": return Math.max(1, lineCount) * GAME_RULES.perLineSec;
    case "lobby":
    case "finished": return null;
  }
}
