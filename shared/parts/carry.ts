// 잡기 (§30): K 홀드=들기, 릴리스=발사. 들린 물체 무해. 소유권은 서버 가중랜덤 중재.
import { TUNING, type Tuning } from "../physics/tuning.js";
import type { Body } from "../physics/body.js";
import type { Avatar, AvatarInput } from "./avatar.js";

export interface Carryable { id: string; body: Body; grabbable: boolean; heldBy: string | null; }

export interface CarryState {
  heldId: string | null;
  prevGrab: boolean;
  selfIgnoreLeftMs: number;  // 던진 직후 자책 방지 (§30-1)
  lastThrownId: string | null;
}

export function createCarryState(): CarryState {
  return { heldId: null, prevGrab: false, selfIgnoreLeftMs: 0, lastThrownId: null };
}

/** 근처 잡기 후보 (없으면 null → 하이라이트 트리거 §39-1) */
export function findGrabTarget(a: Avatar, items: Carryable[], t: Tuning = TUNING): Carryable | null {
  const reach = t.world.tileSize * 1.2;
  let best: Carryable | null = null, bd = Infinity;
  for (const it of items) {
    if (!it.grabbable || it.heldBy) continue;
    const d = Math.hypot(it.body.x - a.body.x, it.body.y - a.body.y);
    if (d < reach && d < bd) { bd = d; best = it; }
  }
  return best;
}

export interface CarryEvent { kind: "grab" | "throw" | "none" | "grabMiss"; id?: string; vx?: number; vy?: number }

/** 매 틱: 잡기 입력 처리. 이벤트 반환(서버 보고용) */
export function stepCarry(cs: CarryState, a: Avatar, input: AvatarInput, items: Carryable[], t: Tuning = TUNING): CarryEvent {
  cs.selfIgnoreLeftMs = Math.max(0, cs.selfIgnoreLeftMs - 1000 / t.world.tickRate);
  const pressed = input.grab && !cs.prevGrab;
  const released = !input.grab && cs.prevGrab;
  cs.prevGrab = input.grab;

  if (pressed && !cs.heldId) {
    const target = findGrabTarget(a, items, t);
    if (!target) return { kind: "grabMiss" };
    cs.heldId = target.id;
    return { kind: "grab", id: target.id };
  }
  if (released && cs.heldId) {
    const id = cs.heldId;
    cs.heldId = null;
    cs.lastThrownId = id;
    cs.selfIgnoreLeftMs = t.carry.selfIgnoreMs;
    const up = input.jump || false;
    const vx = up ? a.body.vx * 0.3 : a.body.facing * (t.carry.throwSpeed + Math.abs(a.body.vx) * t.carry.vxCarryFactor);
    const vy = up ? t.carry.upThrowSpeed : -80;
    return { kind: "throw", id, vx, vy };
  }
  return { kind: "none" };
}

/** 들린 물체 위치 고정 (완전 무해 — 이미지일 뿐, §30-2) */
export function pinHeldItem(a: Avatar, item: Carryable): void {
  item.body.x = a.body.x + a.body.facing * (a.body.w / 2 + item.body.w / 2);
  item.body.y = a.body.y - a.body.h * 0.3;
  item.body.vx = 0; item.body.vy = 0;
}
