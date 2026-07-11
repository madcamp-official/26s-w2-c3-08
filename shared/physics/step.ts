// 플레이어 1명의 1틱 물리. 서버(권위)와 클라(예측)가 같은 함수를 실행한다.
// 모든 조작감 수치는 tuning.json에서만 온다 — 여기에 숫자 하드코딩 금지.

import type { PlayerInput, PlayerPhys, Rect, Terrain } from "./types.js";
import { TUNING, type Tuning } from "./tuning.js";

/**
 * 현재 상태의 실제 히트박스 높이. 웅크리기·슬라이딩 = 0.95타일로 "실제" 축소.
 * 좌표 규약: p.y는 항상 "선 키" 기준 상단이고 발(p.y + playerH)이 고정점.
 * 축소 시 히트박스 상단만 아래로 내려온다 (hitTop 참조).
 */
export function physHeight(p: PlayerPhys, t: Tuning = TUNING): number {
  return p.crouch || p.slide
    ? t.crouch.heightTiles * t.world.tileSize
    : t.world.playerH;
}

/** 실제 히트박스 상단 y */
export function hitTop(p: PlayerPhys, t: Tuning = TUNING): number {
  return p.y + (t.world.playerH - physHeight(p, t));
}

export function stepPlayer(
  p: PlayerPhys,
  input: PlayerInput,
  dtMs: number,
  terrain: Terrain,
  t: Tuning = TUNING,
): void {
  const dt = dtMs / 1000;
  const W = t.world.playerW;
  const H = t.world.playerH;

  const jumpPressed = input.jump && !p.prevJumpHeld;
  p.prevJumpHeld = input.jump;

  // ── 내려찍기 상태 머신 ─────────────────────────────
  if (p.pound === 0 && !p.slide && input.down && !p.grounded) {
    if (p.spinLeftMs > 0) {
      // 스핀파운드 (오디세이): 스핀 중 ↓ = 시동 정지 생략, 즉시 낙하
      p.pound = 2;
      p.spinLeftMs = 0;
      p.vx = 0;
    } else {
      p.pound = 1;                     // hang: 공중 정지
      p.poundHangLeftMs = t.pound.hangMs;
      p.vx = 0;
      p.vy = 0;
    }
  }

  if (p.pound === 1) {
    // 공중 정지 (0.25초). 초반에는 살짝 상승 (64 원작 — 첫 10프레임 부양)
    // 스핀 캔슬: 공중 스핀이 남아 있으면 점프 입력으로 내려찍기 해제
    if (jumpPressed && !p.spinUsed) {
      p.pound = 0;
      startSpin(p, t);
      p.vy = 0;
    } else {
      const elapsedMs = t.pound.hangMs - p.poundHangLeftMs;
      p.vx = 0;
      p.vy = elapsedMs < t.pound.riseMs ? t.pound.riseVelocity : 0;
      p.poundHangLeftMs -= dtMs;
      if (p.poundHangLeftMs <= 0) p.pound = 2;
      integrate(p, dt, terrain, W, H, t);
      return;
    }
  }

  if (p.pound === 2) {
    // 스핀 캔슬: 낙하 중에도 가능 (스핀을 아직 안 썼을 때만 — 공짜 캔슬 방지)
    if (jumpPressed && !p.spinUsed) {
      p.pound = 0;
      startSpin(p, t);
      p.vy = 0;
    } else {
      // 수직 낙하: 좌우 완전 고정 (어떤 경우에도 밀리지 않음 — player-spec)
      p.vx = 0;
      p.vy = t.pound.fallVelocity;
      integrate(p, dt, terrain, W, H, t);
      if (p.grounded) {
        p.pound = 0;
        p.poundLandLeftMs = t.pound.jumpWindowMs; // 내려찍기 점프 유예 (3D월드)
        // 착지 지점이 경사면이면 슬라이딩으로 전환 (player-spec)
        if (p.onSlopeDir !== 0) p.slide = true;
      }
      return;
    }
  }

  // ── 슬라이딩 상태 머신 (유효 입력은 점프뿐 — player-spec) ──
  if (p.slide) {
    p.crouch = false;
    if (jumpPressed && (p.grounded || p.coyoteLeftMs > 0) && standingOk(p, terrain, W, H)) {
      // 좌우 가속(vx)을 유지한 채 슬라이딩 취소 + 점프 (천장에 막히면 무시)
      p.slide = false;
      doJump(p, t, 1);
    } else {
      if (p.grounded) {
        if (p.onSlopeDir !== 0) {
          // 내리막 방향으로 가속 (dir=1은 오른쪽이 높으므로 내리막은 왼쪽)
          const downhill = -p.onSlopeDir;
          p.vx = approach(p.vx, downhill * t.slide.maxSpeed, t.slide.accel * dt);
        } else {
          // 평평한 지형: 감속하다가 느려지면 해제
          p.vx = approach(p.vx, 0, t.slide.flatDecel * dt);
          if (Math.abs(p.vx) < t.slide.exitSpeed) {
            p.slide = false;
            // 일어설 공간이 없으면(터널 안) 강제 웅크리기로 전환
            if (!standingOk(p, terrain, W, H)) p.crouch = true;
          }
        }
      }
      p.coyoteLeftMs = p.grounded ? t.jump.coyoteMs : Math.max(0, p.coyoteLeftMs - dtMs);
      p.vy = Math.min(p.vy + t.gravity.base * t.gravity.fallMult * dt, t.gravity.maxFallSpeed);
      integrate(p, dt, terrain, W, H, t);
      updateChainWindow(p, dtMs, t);
      return;
    }
  }

  // ── 웅크리기 (지상 ↓). 히트박스 실제 축소.
  //    ↓를 놓아도 일어설 공간이 없으면(천장) 웅크림 강제 유지 ──
  const wantCrouch = p.grounded && input.down;
  p.crouch = wantCrouch || (p.crouch && !standingOk(p, terrain, W, H));
  // 고속 웅크리기 → 슬라이딩 전환
  if (wantCrouch && Math.abs(p.vx) >= t.slide.crouchMinSpeed) {
    p.crouch = false;
    p.slide = true;
  }

  // ── 일반 이동 (Shift = 달리기) ─────────────────────
  const dir = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  if (dir !== 0) p.facing = dir as 1 | -1;

  const control = p.grounded ? 1 : t.run.airControlFactor;
  const crouchMult = p.crouch ? t.crouch.speedMult : 1;
  const topSpeed = input.run ? t.run.runMaxSpeed : t.run.maxSpeed;
  const target = dir * topSpeed * crouchMult;
  const rate = (dir !== 0 ? t.run.accel : t.run.decel) * control;
  p.vx = approach(p.vx, target, rate * dt);

  // ── 코요테 / 점프 버퍼 ─────────────────────────────
  p.coyoteLeftMs = p.grounded ? t.jump.coyoteMs : Math.max(0, p.coyoteLeftMs - dtMs);
  if (jumpPressed) p.jumpBufferLeftMs = t.jump.bufferMs;
  else p.jumpBufferLeftMs = Math.max(0, p.jumpBufferLeftMs - dtMs);

  // ── 벽점프 (공중에서 벽 접촉 중 점프) ──────────────
  const airborne = !p.grounded && p.coyoteLeftMs <= 0;
  if (jumpPressed && airborne && p.touchingWall !== 0) {
    p.vx = -p.touchingWall * t.wallJump.kickVx;
    p.vy = t.wallJump.kickVy;
    p.facing = (-p.touchingWall) as 1 | -1;
    p.jumpBufferLeftMs = 0;
    p.jumpChain = 0;
  }
  // ── 공중 스핀 (벽 접촉이 없을 때만. 공중 1회 — 착지해야 리셋) ──
  else if (jumpPressed && airborne && !p.spinUsed) {
    startSpin(p, t);
  }
  p.spinLeftMs = Math.max(0, p.spinLeftMs - dtMs);

  // ── 점프 (트리플 점프 / 내려찍기 점프 + 속도 비례 보너스) ──
  if (p.jumpBufferLeftMs > 0 && (p.grounded || p.coyoteLeftMs > 0)) {
    const chainOk =
      p.chainLeftMs > 0 &&
      Math.abs(p.vx) >= t.run.runMaxSpeed * t.tripleJump.minSpeedFrac;
    p.jumpChain = chainOk ? (p.jumpChain + 1) % 3 : 0;
    const chainMult =
      p.jumpChain === 1 ? t.tripleJump.secondMult
      : p.jumpChain === 2 ? t.tripleJump.thirdMult
      : 1;
    // 내려찍기 착지 직후면 강화 점프 — 트리플 점프와는 큰 쪽만 적용
    const poundMult = p.poundLandLeftMs > 0 ? t.pound.jumpMult : 1;
    doJump(p, t, Math.max(chainMult, poundMult));
    if (p.jumpChain === 2) p.spinLeftMs = t.spin.durationMs; // 3단 점프 공중제비 연출
  }

  // ── 중력 (가변 점프: 상승 중 버튼 놓으면 무거워짐) ──
  let g = t.gravity.base;
  if (p.vy < 0 && !input.jump) g *= t.gravity.riseReleaseMult;
  if (p.vy > 0) g *= t.gravity.fallMult;
  if (p.spinLeftMs > 0 && p.vy > 0) g *= t.spin.gravityMult; // 스핀 중 낙하 감속
  p.vy = Math.min(p.vy + g * dt, t.gravity.maxFallSpeed);

  // ── 벽 슬라이드: 벽을 향해 밀고 있으면 낙하 감속 ──
  if (!p.grounded && p.touchingWall !== 0 && dir === p.touchingWall && p.vy > t.wallJump.slideMaxFall) {
    p.vy = t.wallJump.slideMaxFall;
  }

  integrate(p, dt, terrain, W, H, t);
  updateChainWindow(p, dtMs, t);
}

/** 점프 공통: 배수(트리플/내려찍기) × 수평 속도 비례 보너스 */
function doJump(p: PlayerPhys, t: Tuning, mult: number): void {
  const runFrac = Math.min(1, Math.abs(p.vx) / t.run.runMaxSpeed);
  p.vy = t.jump.velocity * mult * (1 + t.jump.runBonus * runFrac);
  p.jumpBufferLeftMs = 0;
  p.coyoteLeftMs = 0;
  p.poundLandLeftMs = 0;
  p.grounded = false;
}

/** 공중 스핀 시작 — 공중 1회 제한 소모 (착지해야 리셋) */
function startSpin(p: PlayerPhys, t: Tuning): void {
  p.spinLeftMs = t.spin.durationMs;
  p.spinUsed = true;
}

/** 착지 기준 타이머들: 트리플 점프 창 / 스핀 쿨타임 리셋 / 내려찍기 점프 유예 */
function updateChainWindow(p: PlayerPhys, dtMs: number, t: Tuning): void {
  if (p.grounded) {
    if (p.wasAirborne) p.chainLeftMs = t.tripleJump.windowMs; // 착지: 창 시작
    else p.chainLeftMs = Math.max(0, p.chainLeftMs - dtMs);
    if (p.chainLeftMs <= 0) p.jumpChain = 0; // 창이 끝나면 체인 리셋
    p.spinUsed = false;                      // 갤럭시식: 착지 시 스핀 재사용 가능
    p.poundLandLeftMs = Math.max(0, p.poundLandLeftMs - dtMs);
  }
  p.wasAirborne = !p.grounded;
}

/** 목표 속도로 rate만큼 접근 (가속/감속 공용) */
function approach(v: number, target: number, delta: number): number {
  if (v < target) return Math.min(v + delta, target);
  if (v > target) return Math.max(v - delta, target);
  return v;
}

/** 일어섰을 때(선 키 히트박스)가 지형과 겹치지 않는지 */
function standingOk(p: PlayerPhys, terrain: Terrain, W: number, H: number): boolean {
  for (const s of terrain.solids) {
    if (overlap(p.x, p.y, W, H, s)) return false;
  }
  return true;
}

/**
 * 축 분리 AABB 이동+충돌 (x 먼저, y 다음) + 경사면 지지. grounded 갱신.
 * 웅크리기·슬라이딩 중에는 축소된 히트박스(상단이 off만큼 내려옴)로 판정한다.
 */
function integrate(p: PlayerPhys, dt: number, terrain: Terrain, W: number, H: number, t: Tuning): void {
  const wasGrounded = p.grounded;
  const effH = physHeight(p, t);
  const off = H - effH; // 히트박스 상단 내림량 (발 위치 고정)
  // X축
  p.x += p.vx * dt;
  p.touchingWall = 0;
  for (const s of terrain.solids) {
    if (!overlap(p.x, p.y + off, W, effH, s)) continue;
    if (p.vx > 0) { p.x = s.x - W; p.touchingWall = 1; }
    else if (p.vx < 0) { p.x = s.x + s.w; p.touchingWall = -1; }
    p.vx = 0;
  }
  // Y축
  p.y += p.vy * dt;
  p.grounded = false;
  for (const s of terrain.solids) {
    if (!overlap(p.x, p.y + off, W, effH, s)) continue;
    if (p.vy > 0) {
      p.y = s.y - H;
      p.grounded = true;
    } else if (p.vy < 0) {
      p.y = s.y + s.h - off;
    }
    p.vy = 0;
  }
  // 경사면: 발 중심 x에서 빗면 높이를 계산해 위에서만 지지 (아래·옆 통과 가능)
  const SNAP_DOWN = 12; // 내리막에서 접지 유지용 스냅 거리(px)
  const footX = p.x + W / 2;
  p.onSlopeDir = 0;
  for (const s of terrain.slopes) {
    if (footX < s.x || footX > s.x + s.w) continue;
    const u = (footX - s.x) / s.w;
    const surfaceY = s.dir === 1 ? s.y + s.h * (1 - u) : s.y + s.h * u;
    const bottom = p.y + H;
    if (p.vy < 0) continue;                          // 상승 중엔 통과
    const penetrating = bottom > surfaceY && p.y < s.y + s.h;
    const snapDown = wasGrounded && bottom >= surfaceY - SNAP_DOWN;
    if (penetrating || snapDown) {
      p.y = surfaceY - H;
      p.vy = 0;
      p.grounded = true;
      p.onSlopeDir = s.dir;
    }
  }
}

function overlap(x: number, y: number, w: number, h: number, s: Rect): boolean {
  return x < s.x + s.w && x + w > s.x && y < s.y + s.h && y + h > s.y;
}
