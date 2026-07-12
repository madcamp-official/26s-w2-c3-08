// 세계 규칙 (§45·§46·§63): 라인 경계, 페이드아웃 소멸, 7.5초 재생성 타이머.
import { TUNING, type Tuning } from "../physics/tuning.js";

export interface LineBounds { startX: number; endX: number; index: number }

/** 깃발 기반 라인 경계 (§63). y는 전체 허용 — x만 판정 */
export function inLine(x: number, line: LineBounds): boolean {
  return x >= line.startX && x <= line.endX;
}

/** 활동체 라인 이탈 판정 (§46) — 이탈 시 즉시 소멸(페이드는 연출) */
export function checkLineExit(x: number, line: LineBounds): boolean {
  return !inLine(x, line);
}

/** 재생성 공용 타이머 */
export interface Respawnable { alive: boolean; respawnLeftMs: number }
export function startRespawn(r: Respawnable, t: Tuning = TUNING): void {
  r.alive = false;
  r.respawnLeftMs = t.rules.respawnMs;
}
