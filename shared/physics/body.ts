// 범용 물리체(Body) + 이동·충돌(moveAndCollide).
// 좌표 규약: (x, y) = 히트박스의 "바닥-중앙" (발 위치). 히트박스 = [x-w/2, y-h] ~ [x+w/2, y].
// 겹침 해소는 MTV(실제 겹침이 얕은 축·방향으로 그만큼만) — 속도 부호 추측 금지.

import { TUNING, type Tuning } from "./tuning.js";
import {
  type Terrain, type Rect,
  facesOf, slopeSurfaceY, querySolids, querySlopes,
} from "./terrain.js";

export interface Body {
  x: number;            // 바닥-중앙 x
  y: number;            // 바닥-중앙 y (발)
  vx: number;
  vy: number;
  w: number;
  h: number;
  grounded: boolean;
  facing: 1 | -1;
  touchingWall: 0 | 1 | -1;   // 1 = 오른쪽 벽에 접촉
  onSlopeDir: 0 | 1 | -1;
  gravity: boolean;
  tags: string[];
  crushed?: boolean;          // 이번 틱 압사 판정 (양쪽 압박)
}

export function createBody(x: number, y: number, w: number, h: number, tags: string[] = []): Body {
  return {
    x, y, vx: 0, vy: 0, w, h,
    grounded: false, facing: 1, touchingWall: 0, onSlopeDir: 0,
    gravity: true, tags,
  };
}

// ── 박스 헬퍼 (바닥-중앙 → AABB) ─────────────────────────
export function left(b: Body): number { return b.x - b.w / 2; }
export function right(b: Body): number { return b.x + b.w / 2; }
export function top(b: Body): number { return b.y - b.h; }
export function bottom(b: Body): number { return b.y; }

function overlapRect(b: Body, r: Rect): boolean {
  return left(b) < r.x + r.w && right(b) > r.x && top(b) < r.y + r.h && bottom(b) > r.y;
}

/** 전역 속도 상한 (§41) — 모든 속도는 항상 클램프 */
export function clampSpeed(b: Body, t: Tuning = TUNING): void {
  const m = t.world.maxSpeed;
  if (b.vx > m) b.vx = m; else if (b.vx < -m) b.vx = -m;
  if (b.vy > m) b.vy = m; else if (b.vy < -m) b.vy = -m;
}

/** 이 위치에 높이 h로 설 수 있는가 (낑김방지·서기·스폰 공용 쿼리. 경사 포함) */
export function canStandAt(body: Body, terrain: Terrain, h: number, _t: Tuning = TUNING): boolean {
  const probe: Body = { ...body, h };
  for (const r of querySolids(terrain, left(probe), top(probe), probe.w, h)) {
    const f = facesOf(r);
    if (!f.top && !f.bottom && !f.left && !f.right) continue;
    if (overlapRect(probe, r)) return false;
  }
  for (const s of querySlopes(terrain)) {
    if (s.kind !== "floor") continue;
    const sy = slopeSurfaceY(s, probe.x);
    if (sy !== null && bottom(probe) > sy + 1 && top(probe) < s.y + s.h) return false;
  }
  return true;
}

/** MTV: 겹친 사각형에서 가장 얕은 축·방향으로 밀어냄. 밀어낸 축 반환 */
function resolveMTV(b: Body, r: Rect): "left" | "right" | "up" | "down" | null {
  const ox1 = right(b) - r.x;          // 왼쪽으로 밀어낼 양
  const ox2 = r.x + r.w - left(b);     // 오른쪽으로
  const oy1 = bottom(b) - r.y;         // 위로
  const oy2 = r.y + r.h - top(b);      // 아래로
  const minX = Math.min(ox1, ox2);
  const minY = Math.min(oy1, oy2);
  const f = facesOf(r);
  if (minX < minY) {
    if (ox1 < ox2) { if (!f.left) return null; b.x -= ox1; return "left"; }
    else { if (!f.right) return null; b.x += ox2; return "right"; }
  } else {
    if (oy1 < oy2) { if (!f.top) return null; b.y -= oy1; return "up"; }
    else { if (!f.bottom) return null; b.y += oy2; return "down"; }
  }
}

/**
 * 이동+충돌 통합. 축분리(x→y) + MTV 해소 + 경사(바닥·천장) + 코너 보정 + 압사 플래그.
 * grounded/touchingWall/onSlopeDir 갱신.
 */
export function moveAndCollide(b: Body, terrain: Terrain, dtMs: number, t: Tuning = TUNING): void {
  const dt = dtMs / 1000;
  clampSpeed(b, t);
  const prevOnSlopeDir = b.onSlopeDir;   // 경사 벽 판정용 — 방금 전 틱까지 타고 있던 경사 기억
  let pushedL = false, pushedR = false, pushedU = false, pushedD = false;

  // ── X축 ──────────────────────────────────────────────
  b.x += b.vx * dt;
  b.touchingWall = 0;
  for (const r of querySolids(terrain, left(b), top(b), b.w, b.h)) {
    if (!overlapRect(b, r)) continue;
    const f = facesOf(r);
    // 반통과(top만)면 x축 충돌 없음
    if (!f.left && !f.right) continue;
    const side = resolveMTV(b, r);
    if (side === "left") { b.touchingWall = 1; b.vx = Math.min(b.vx, 0); pushedL = true; }
    else if (side === "right") { b.touchingWall = -1; b.vx = Math.max(b.vx, 0); pushedR = true; }
    else if (side === "up" || side === "down") {
      // x이동인데 y로 풀린 경우 = 코너 스침 → 코너 보정 후보
      if (side === "up" && bottom(b) - r.y <= t.corner.footSnapPx) { /* 발 보정: 이미 올려짐 */ }
      else if (side === "down" && r.y + r.h - top(b) <= t.corner.headSnapPx) { /* 머리 보정 */ }
    }
  }

  // ── Y축 ──────────────────────────────────────────────
  b.y += b.vy * dt;
  b.grounded = false;
  for (const r of querySolids(terrain, left(b), top(b), b.w, b.h)) {
    if (!overlapRect(b, r)) continue;
    const f = facesOf(r);
    const falling = b.vy >= 0;
    // 반통과: 위에서 떨어질 때만, 이전 프레임 발이 상단 위였을 때만 지지
    if (f.top && !f.bottom && !f.left && !f.right) {
      const prevBottom = bottom(b) - b.vy * dt;
      if (!falling || prevBottom > r.y + 1) continue;
      b.y = r.y; b.vy = 0; b.grounded = true; continue;
    }
    const side = resolveMTV(b, r);
    if (side === "up") { b.grounded = true; b.vy = Math.min(b.vy, 0); pushedU = true; b.vy = 0; }
    else if (side === "down") { b.vy = Math.max(b.vy, 0); pushedD = true; }
    else if (side === "left" || side === "right") {
      // y이동인데 x로 풀림 = 모서리 → 코너 보정 (머리: 옆으로 밀어 통과)
      const over = side === "left" ? right(b) - r.x : r.x + r.w - left(b);
      if (over > Math.max(t.corner.footSnapPx, t.corner.headSnapPx)) {
        // 보정 범위 밖: 정상 벽 취급
        b.touchingWall = side === "left" ? 1 : -1;
      }
    }
  }

  // ── 바닥 경사(밟는 대각선 면) — 벽 판정보다 먼저 계산해서, 이번 틱에 경사 표면에 정상적으로
  // 얹히는 경우(막 다 올라왔거나, 옆 경사 틈 사이로 떨어지다가 반대쪽 경사면에 착지하는 경우
  // 등)를 "밖에서 침입"으로 오판해 벽이 순간이동시키는 걸 막는다(2026-07-16, 봉우리 사이가
  // 뚫려 있는 경우까지 재현 리포트로 확인).
  b.onSlopeDir = 0;
  for (const s of querySlopes(terrain)) {
    if (s.kind === "floor") {
      const sy = slopeSurfaceY(s, b.x);
      if (sy === null || b.vy < 0) continue;
      // "아쉽게 못 올라가도 붙여주는" 관대한 스냅(wasGrounded 기반 최대 12px 미리 당김)은
      // 경사에서는 적용하지 않는다(2026-07-16) — 실제로 겹친 경우(pen)만 표면에 붙임.
      const pen = bottom(b) > sy && top(b) < s.y + s.h;
      if (pen) {
        b.y = sy; b.vy = 0; b.grounded = true; b.onSlopeDir = s.dir;
      }
    } else {
      // 천장 경사: 상승 모멘텀만 상쇄, 수평 유지 (§asset 원작 거동)
      const sy = slopeSurfaceY(s, b.x);
      if (sy === null) continue;
      const ceilBottom = s.y + s.h - (sy - s.y); // 반전: 아래로 내려온 천장면
      if (top(b) < ceilBottom && bottom(b) > s.y && b.vy < 0) b.vy = 0;
    }
  }

  // ── 경사 벽·밑면 (§2026-07-16: 밟는 대각선 말고 나머지 두 면도 기본 단단함, 옵션으로 끌 수 있음) ──
  // 삼각형이라 일반 solids MTV 재사용이 애매해 전용 처리. 위 대각선 스냅 이후에 실행. 벽은
  // "이 경사에도, 방금 전 틱까지도 지지받지 못한 채" 옆에서 파고들 때만 막는다 — 꼭짓점을
  // 막 넘어서는 그 정확한 틱은 이번 틱 표면 지지(null)와 직전 틱 지지(prevOnSlopeDir) 중
  // 하나로 반드시 잡힘(2026-07-16, "넘어가는 순간 순간이동" 재현으로 확인 — onSlopeDir 리셋과
  // 같은 틱에 벽이 반응해서 직전 틱 값을 안 보면 그 찰나의 프레임을 놓침).
  for (const s of querySlopes(terrain)) {
    if (s.kind !== "floor") continue;
    if (b.onSlopeDir === s.dir || prevOnSlopeDir === s.dir) continue;
    const faces = s.faces ?? {};
    const wallX = s.dir === 1 ? s.x + s.w : s.x;
    if (faces.side !== false) {
      // 벽 쪽으로 "이동 중"일 때만 막는다(진짜 벽 충돌의 정의). 이 조건이 없으면 꼭짓점을 넘어
      // 벽 반대쪽으로 걸어나가는 몸(몸통 절반이 아직 벽 x에 걸쳐 있고 한 틱 낙하로 세로 겹침도
      // 참이 되는 상태)을 "침입"으로 오판해 벽 바깥으로 최대 반폭(32px)씩 밀어버림 — 그 밀린
      // 자리가 공중이라 구덩이 낙하까지 이어지던 순간이동 버그의 실원인(2026-07-16 확정).
      const movingIntoWall = s.dir === 1 ? b.vx < 0 : b.vx > 0;
      const onOutside = s.dir === 1 ? b.x > wallX : b.x < wallX;
      const overlapsY = bottom(b) > s.y && top(b) < s.y + s.h;
      const crossesWall = s.dir === 1 ? left(b) < wallX : right(b) > wallX;
      if (movingIntoWall && onOutside && overlapsY && crossesWall) {
        if (s.dir === 1) { b.x = wallX + b.w / 2; b.vx = 0; b.touchingWall = -1; }
        else { b.x = wallX - b.w / 2; b.vx = 0; b.touchingWall = 1; }
      }
    }
    if (faces.bottom !== false) {
      const overlapsX = right(b) > s.x && left(b) < s.x + s.w;
      const slopeBottom = s.y + s.h;
      if (overlapsX && b.vy < 0 && top(b) < slopeBottom && bottom(b) > slopeBottom) {
        b.y = slopeBottom + b.h; b.vy = 0;
      }
    }
  }

  // ── 압사: 서로 반대 방향으로 동시에 밀렸으면 ─────────
  b.crushed = (pushedL && pushedR) || (pushedU && pushedD);
}
