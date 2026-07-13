// 아바타(플레이어) 컨트롤러 — 키 입력을 Body 명령으로 변환하는 stepAvatar.
// 서버(권위 없음, relay)가 아니라 "각 클라 로컬 권위"로 실행된다 (§14).
// 능력: 이동/달리기/가변점프(코요테·버퍼·속도보너스)/내려찍기/웅크리기(1칸 고정)/
// 슬라이딩/공중스핀(1회, 리셋=착지·벽점프·벽슬라이드)/벽타기(마리오식 2단 상한)/천장점프연출.
// 트리플 점프 없음(§35). 크기 단계(§59). 좌표 = 바닥-중앙.

import { TUNING, type Tuning } from "../physics/tuning.js";
import {
  type Body, createBody, moveAndCollide, canStandAt, clampSpeed,
} from "../physics/body.js";
import type { Terrain } from "../physics/terrain.js";

export interface AvatarInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  down: boolean;
  run: boolean;
  grab: boolean;   // K
  tick: number;
}

export type PoundState = 0 | 1 | 2; // 0 none / 1 hang / 2 fall
export type SizeStage = 1 | 2 | 3;

export interface Avatar {
  body: Body;
  baseW: number;             // 2단계(기본) 히트박스 (그림에서 자동 산출)
  baseH: number;
  sizeStage: SizeStage;
  hp: number;                // 1~2
  // 능력 상태
  pound: PoundState;
  poundHangLeftMs: number;
  poundLandLeftMs: number;
  stompComboLeftMs: number;  // 밟기 직후 강화 점프 유예 (마리오식)
  airborneStartY: number;    // 내려찍기 최소높이 판정
  crouch: boolean;
  slide: boolean;
  spinLeftMs: number;
  spinUsed: boolean;
  wallGrabMs: number;        // 벽 접촉 경과 (2단 상한)
  wallClingGraceMs: number;  // 반대/무입력 유예
  coyoteLeftMs: number;
  jumpBufferLeftMs: number;
  prevJumpHeld: boolean;
  freezeLeftMs: number;      // 아이템 획득 0.4초 고정 (§58)
  stunLeftMs: number;        // 내려찍기에 밟힘 = 기절(조작 무시, 물리는 유지)
  pushedVx: number;          // 상대가 밀어 넣는 외력 속도 (pushForce 수신, 당하는 쪽 적용)
  pushedLeftMs: number;      // 외력 잔여(계속 밀리면 갱신, 떼면 감쇠)
  // modifier 스택 (§25): 이름 → 배율/잔여ms
  speedMult: number;
  speedMultLeftMs: number;
  invincibleLeftMs: number;
  // 연출 트리거 (렌더가 소비)
  fx: Set<string>;           // "ceilBonk" | "jumped" | "landed" ...
}

export function createAvatar(x: number, y: number, hitboxH: number, t: Tuning = TUNING): Avatar {
  const w = t.world.tileSize;
  return {
    body: createBody(x, y, w, hitboxH, ["player"]),
    baseW: w, baseH: hitboxH, sizeStage: 2, hp: 1,
    pound: 0, poundHangLeftMs: 0, poundLandLeftMs: 0, stompComboLeftMs: 0, airborneStartY: y,
    crouch: false, slide: false, spinLeftMs: 0, spinUsed: false,
    wallGrabMs: 0, wallClingGraceMs: 0,
    coyoteLeftMs: 0, jumpBufferLeftMs: 0, prevJumpHeld: false,
    freezeLeftMs: 0, stunLeftMs: 0, pushedVx: 0, pushedLeftMs: 0,
    speedMult: 1, speedMultLeftMs: 0, invincibleLeftMs: 0,
    fx: new Set(),
  };
}

/** 크기 단계 적용 (§59): 1=1×1타일 고정, 2=기본, 3=가로2×·세로1.5× */
export function applySizeStage(a: Avatar, stage: SizeStage, t: Tuning = TUNING): void {
  a.sizeStage = stage;
  if (stage === 1) { a.body.w = t.sizeStage.smallW; a.body.h = t.sizeStage.smallH; }
  else if (stage === 3) { a.body.w = a.baseW * t.sizeStage.bigWMult; a.body.h = a.baseH * t.sizeStage.bigHMult; }
  else { a.body.w = a.baseW; a.body.h = a.baseH; }
}

/** 현재 서있는 키 (웅크림 반영). 웅크림 = 크기 무관 0.95타일 (§59) */
function standingH(a: Avatar, t: Tuning): number {
  return a.crouch || a.slide ? t.crouch.heightTiles * t.world.tileSize : a.body.h;
}

export function stepAvatar(a: Avatar, input: AvatarInput, dtMs: number, terrain: Terrain, t: Tuning = TUNING): void {
  const b = a.body;
  const dt = dtMs / 1000;

  // 아이템 획득 고정 (§58): 위치 고정·무엇에도 안 밀림
  if (a.freezeLeftMs > 0) {
    a.freezeLeftMs -= dtMs;
    b.vx = 0; b.vy = 0;
    return;
  }

  // 기절(내려찍기에 밟힘): 조작 무시. 물리(중력·넉백 속도·충돌)는 그대로 진행
  if (a.stunLeftMs > 0) {
    a.stunLeftMs -= dtMs;
    input = { ...input, left: false, right: false, jump: false, down: false, run: false, grab: false };
  }

  // modifier 타이머
  if (a.speedMultLeftMs > 0) { a.speedMultLeftMs -= dtMs; if (a.speedMultLeftMs <= 0) a.speedMult = 1; }
  if (a.invincibleLeftMs > 0) a.invincibleLeftMs -= dtMs;
  if (a.pushedLeftMs > 0) a.pushedLeftMs -= dtMs;   // 외력 감쇠(계속 밀리면 수신부에서 갱신)

  const jumpPressed = input.jump && !a.prevJumpHeld;
  a.prevJumpHeld = input.jump;
  const wasGrounded = b.grounded;

  // 공중 시작점 기록 (내려찍기 최소높이)
  if (wasGrounded) a.airborneStartY = b.y;

  // ── 내려찍기 상태 머신 ─────────────────────────────
  const highEnough = Math.abs(b.y - a.airborneStartY) >= t.pound.minHeightPx || b.y > a.airborneStartY;
  if (a.pound === 0 && !a.slide && input.down && !b.grounded && highEnough) {
    if (a.spinLeftMs > 0) { a.pound = 2; a.spinLeftMs = 0; b.vx = 0; } // 스핀파운드
    else { a.pound = 1; a.poundHangLeftMs = t.pound.hangMs; b.vx = 0; b.vy = 0; }
  }
  if (a.pound === 1) {
    if (jumpPressed && !a.spinUsed) { a.pound = 0; startSpin(a, t); b.vy = 0; }
    else {
      const elapsed = t.pound.hangMs - a.poundHangLeftMs;
      b.vx = 0;
      b.vy = elapsed < t.pound.riseMs ? t.pound.riseVelocity : 0;
      a.poundHangLeftMs -= dtMs;
      if (a.poundHangLeftMs <= 0) a.pound = 2;
      moveAndCollide(b, terrain, dtMs, t);
      return;
    }
  }
  if (a.pound === 2) {
    if (jumpPressed && !a.spinUsed) { a.pound = 0; startSpin(a, t); b.vy = 0; }
    else {
      b.vx = 0; b.vy = t.pound.fallVelocity;
      moveAndCollide(b, terrain, dtMs, t);
      if (b.grounded) {
        a.pound = 0;
        a.poundLandLeftMs = t.pound.jumpWindowMs;
        // 경사면 착지 → 슬라이드: 0이 아닌 일정 시작속도에서 출발해 가속(§내려찍기 슬라이드)
        if (b.onSlopeDir !== 0) { a.slide = true; b.vx = -b.onSlopeDir * t.slide.slopeStartSpeed; }
        a.fx.add("poundLand");
      }
      return;
    }
  }

  // ── 슬라이딩 (유효 입력 점프뿐) ─────────────────────
  if (a.slide) {
    a.crouch = false;
    const canStand = canStandAt(b, terrain, a.body.h, t);
    if (jumpPressed && (b.grounded || a.coyoteLeftMs > 0) && canStand) {
      a.slide = false;
      doJump(a, t, 1);
    } else {
      if (b.grounded) {
        if (b.onSlopeDir !== 0) {
          b.vx = approach(b.vx, -b.onSlopeDir * t.slide.maxSpeed, t.slide.accel * dt);
        } else {
          b.vx = approach(b.vx, 0, t.slide.flatDecel * dt);
          if (Math.abs(b.vx) < t.slide.exitSpeed) {
            a.slide = false;
            if (!canStand) a.crouch = true;
          }
        }
      }
      a.coyoteLeftMs = b.grounded ? t.jump.coyoteMs : Math.max(0, a.coyoteLeftMs - dtMs);
      applyGravity(a, input, dt, t);
      collideWithCrouchHeight(a, terrain, dtMs, t);
      return;
    }
  }

  // ── 웅크리기 (크기 무관 1칸, 천장 강제 유지) ────────
  const wantCrouch = b.grounded && input.down;
  a.crouch = wantCrouch || (a.crouch && !canStandAt(b, terrain, a.body.h, t));
  if (wantCrouch && Math.abs(b.vx) >= t.slide.crouchMinSpeed) { a.crouch = false; a.slide = true; }

  // ── 이동 ────────────────────────────────────────────
  const dir = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  if (dir !== 0) b.facing = dir as 1 | -1;
  const control = b.grounded ? 1 : t.run.airControlFactor;
  const crouchMult = a.crouch ? t.crouch.speedMult : 1;
  const top = (input.run ? t.run.runSpeed : t.run.walkSpeed) * a.speedMult;
  const rate = (dir !== 0 ? t.run.accel : t.run.decel) * control;
  // 외력(상대 밀기)은 입력 목표에 더해짐 → 반대로 걸으면 부분 상쇄(저항), 무입력이면 그 속도로 밀려남
  const pushTarget = a.pushedLeftMs > 0 ? a.pushedVx : 0;
  b.vx = approach(b.vx, dir * top * crouchMult + pushTarget, rate * dt);

  // ── 코요테 / 버퍼 ───────────────────────────────────
  a.coyoteLeftMs = b.grounded ? t.jump.coyoteMs : Math.max(0, a.coyoteLeftMs - dtMs);
  if (jumpPressed) a.jumpBufferLeftMs = t.jump.bufferMs;
  else a.jumpBufferLeftMs = Math.max(0, a.jumpBufferLeftMs - dtMs);

  // ── 벽타기 / 벽점프 (마리오식, §34) ─────────────────
  const airborne = !b.grounded && a.coyoteLeftMs <= 0;
  const towardWall = b.touchingWall !== 0 && dir === b.touchingWall;
  if (airborne && b.touchingWall !== 0) {
    if (towardWall) a.wallClingGraceMs = t.wallSlide.clingGraceMs;
    else a.wallClingGraceMs = Math.max(0, a.wallClingGraceMs - dtMs);
  } else {
    a.wallClingGraceMs = 0;
    a.wallGrabMs = 0;
  }
  const clinging = airborne && b.touchingWall !== 0 && (towardWall || a.wallClingGraceMs > 0);
  if (clinging) {
    a.wallGrabMs += dtMs;
    if (a.spinUsed) a.spinUsed = false; // 벽 슬라이드 = 스핀 리셋 (§16)
  }

  if (jumpPressed && airborne && b.touchingWall !== 0) {
    // 벽점프
    b.vx = -b.touchingWall * t.wallSlide.kickVx;
    b.vy = t.wallSlide.kickVy;
    b.facing = (-b.touchingWall) as 1 | -1;
    a.jumpBufferLeftMs = 0;
    a.spinUsed = false; // 벽점프 = 스핀 리셋
    a.fx.add("wallJump");
  } else if (jumpPressed && airborne && !a.spinUsed) {
    startSpin(a, t);
  }
  a.spinLeftMs = Math.max(0, a.spinLeftMs - dtMs);

  // ── 점프 (내려찍기 점프 배수 / 밟기 직후 강화 — 선입력 버퍼가 창에 적용돼 씹힘 방지) ──
  a.stompComboLeftMs = Math.max(0, a.stompComboLeftMs - dtMs);
  if (a.jumpBufferLeftMs > 0 && (b.grounded || a.coyoteLeftMs > 0 || a.stompComboLeftMs > 0)) {
    const mult = Math.max(
      a.poundLandLeftMs > 0 ? t.pound.jumpMult : 1,
      a.stompComboLeftMs > 0 ? t.stomp.jumpMult : 1,
    );
    a.stompComboLeftMs = 0;
    doJump(a, t, mult);
  }
  if (b.grounded) a.poundLandLeftMs = Math.max(0, a.poundLandLeftMs - dtMs);

  // ── 중력 + 벽 슬라이드 상한 ─────────────────────────
  applyGravity(a, input, dt, t);
  if (clinging && b.vy > 0) {
    const cap = a.wallGrabMs < t.wallSlide.grabMs ? t.wallSlide.grabMaxFall : t.wallSlide.maxFall;
    if (b.vy > cap) b.vy = cap;
  }

  // ── 천장 막힌 점프 연출 트리거 (§26-2) ──────────────
  const risingBefore = b.vy < 0;
  collideWithCrouchHeight(a, terrain, dtMs, t);
  if (risingBefore && b.vy === 0 && !b.grounded) a.fx.add("ceilBonk");
  if (!wasGrounded && b.grounded) { a.fx.add("landed"); a.spinUsed = false; }
}

// ── 내부 헬퍼 ─────────────────────────────────────────
export function startSpin(a: Avatar, t: Tuning): void {
  a.spinLeftMs = t.spin.durationMs;
  a.spinUsed = true;
  a.fx.add("spin");
}

function doJump(a: Avatar, t: Tuning, mult: number): void {
  const b = a.body;
  const runFrac = Math.min(1, Math.abs(b.vx) / t.run.runSpeed);
  b.vy = t.jump.velocity * mult * (1 + t.jump.runBonus * runFrac);
  a.jumpBufferLeftMs = 0;
  a.coyoteLeftMs = 0;
  a.poundLandLeftMs = 0;
  b.grounded = false;
  a.fx.add("jumped");
}

function applyGravity(a: Avatar, input: AvatarInput, dt: number, t: Tuning): void {
  const b = a.body;
  if (!b.gravity) return;
  let g = t.gravity.base;
  if (b.vy < 0 && !input.jump) g *= t.gravity.riseReleaseMult;
  if (b.vy > 0) g *= t.gravity.fallMult;
  if (a.spinLeftMs > 0 && b.vy > 0) g *= t.spin.gravityMult;
  b.vy = Math.min(b.vy + g * dt, t.gravity.maxFallSpeed);
  clampSpeed(b, t);
}

/** 웅크림/슬라이드 시 줄어든 키로 충돌 (h 임시 교체) */
function collideWithCrouchHeight(a: Avatar, terrain: Terrain, dtMs: number, t: Tuning): void {
  const fullH = a.body.h;
  const h = standingH(a, t);
  a.body.h = h;
  moveAndCollide(a.body, terrain, dtMs, t);
  a.body.h = fullH;
}

function approach(v: number, target: number, delta: number): number {
  if (v < target) return Math.min(v + delta, target);
  if (v > target) return Math.max(v - delta, target);
  return v;
}

