// 고스트(다른 플레이어)·몬스터 표현: dead reckoning(속도 외삽) + LERP 수렴 (§21-1)
import { TUNING } from "shared/physics";

export interface GhostView {
  x: number; y: number;       // 화면 표시 좌표 (외삽+보간 결과)
  lastX: number; lastY: number;
  lastVx: number; lastVy: number;
}

export function createGhostView(x: number, y: number): GhostView {
  return { x, y, lastX: x, lastY: y, lastVx: 0, lastVy: 0 };
}

/** 서버 상태 수신 시 호출 */
export function ghostServerUpdate(g: GhostView, x: number, y: number, vx: number, vy: number): void {
  g.lastX = x; g.lastY = y; g.lastVx = vx; g.lastVy = vy;
}

/** 매 프레임: 외삽된 목표를 향해 LERP */
export function ghostStep(g: GhostView, dtMs: number, lerp = TUNING.net.ghostLerp): void {
  g.lastX += g.lastVx * (dtMs / 1000);   // dead reckoning: 서버 속도로 이어서 이동
  g.lastY += g.lastVy * (dtMs / 1000);
  g.x += (g.lastX - g.x) * lerp;
  g.y += (g.lastY - g.y) * lerp;
}
