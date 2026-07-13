// 고스트(다른 플레이어)·몬스터 표현.
// 플레이어·몬스터 = 스냅샷 보간(과거 실제 위치 사이를 재생 — 예측 안 함, 지형 뚫기·러버밴딩 없음).
// 발사체·이동블록 = dead reckoning + LERP (직선/서버시뮬이라 문제 없음).
import { TUNING } from "shared/physics";

export interface Snapshot { t: number; x: number; y: number; }

export interface GhostView {
  x: number; y: number;       // 화면 표시 좌표 (= 판정에도 쓰는 지연 위치)
  lastX: number; lastY: number;
  lastVx: number; lastVy: number;  // 최신 서버 속도 (밟기 vy·밀기 판정용)
  srvX: number; srvY: number;      // 마지막으로 받은 서버 좌표 (새 패치 감지용)
  buf: Snapshot[];                 // 스냅샷 보간 버퍼 (시간순)
}

export function createGhostView(x: number, y: number): GhostView {
  return { x, y, lastX: x, lastY: y, lastVx: 0, lastVy: 0, srvX: x, srvY: y, buf: [] };
}

/** 새 서버 패치 도착 시: 스냅샷 push + 최신값 갱신. buf는 최근 ~0.5초만 유지 */
export function ghostSnapshot(g: GhostView, t: number, x: number, y: number, vx: number, vy: number): void {
  g.srvX = x; g.srvY = y; g.lastVx = vx; g.lastVy = vy;
  g.buf.push({ t, x, y });
  const cutoff = t - 500;
  while (g.buf.length > 2 && g.buf[0].t < cutoff) g.buf.shift();
}

/** 매 프레임: renderT(=지금−지연) 시점을, 버퍼의 실제 위치 두 개 사이를 보간해 x/y 설정.
 *  최신보다 미래면 홀드(외삽 안 함) → 예측 아티팩트 없음 */
export function ghostRenderAt(g: GhostView, renderT: number): void {
  const buf = g.buf;
  if (buf.length === 0) return;
  if (renderT <= buf[0].t) { g.x = buf[0].x; g.y = buf[0].y; return; }
  const last = buf[buf.length - 1];
  if (renderT >= last.t) { g.x = last.x; g.y = last.y; return; }   // 홀드
  for (let i = buf.length - 1; i > 0; i--) {
    const a = buf[i - 1], b = buf[i];
    if (a.t <= renderT && renderT <= b.t) {
      const span = b.t - a.t;
      const f = span > 0 ? (renderT - a.t) / span : 0;
      g.x = a.x + (b.x - a.x) * f;
      g.y = a.y + (b.y - a.y) * f;
      return;
    }
  }
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
