// 고스트(다른 플레이어)·몬스터 표현: dead reckoning(속도 외삽) + LERP 수렴 (§21-1)
import { TUNING } from "shared/physics";

export interface GhostView {
  x: number; y: number;       // 화면 표시 좌표 (외삽+보간 결과)
  lastX: number; lastY: number;
  lastVx: number; lastVy: number;
  srvX: number; srvY: number;  // 마지막으로 받은 "서버 원본" 좌표 (새 패치 감지용)
}

export function createGhostView(x: number, y: number): GhostView {
  return { x, y, lastX: x, lastY: y, lastVx: 0, lastVy: 0, srvX: x, srvY: y };
}

/** 새 서버 패치 도착 시에만 호출 (매 프레임 X). 외삽 누적값을 서버값으로 재기준점 */
export function ghostServerUpdate(g: GhostView, x: number, y: number, vx: number, vy: number): void {
  g.lastX = x; g.lastY = y; g.lastVx = vx; g.lastVy = vy;
  g.srvX = x; g.srvY = y;
}

/** 매 프레임: 외삽된 목표를 향해 LERP */
export function ghostStep(g: GhostView, dtMs: number, lerp = TUNING.net.ghostLerp): void {
  g.lastX += g.lastVx * (dtMs / 1000);   // dead reckoning: 서버 속도로 이어서 이동
  g.lastY += g.lastVy * (dtMs / 1000);
  g.x += (g.lastX - g.x) * lerp;
  g.y += (g.lastY - g.y) * lerp;
}
