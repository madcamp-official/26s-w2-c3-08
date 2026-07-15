// 블록 파츠 (§44): 축 조합. 정적이면 지형으로, 상태·이동이 있으면 동적으로.
// 이동도 behavior 규칙으로 통합 (§65). 상태(파괴·실체화·스위치·재생성)는 여기서.
import { TUNING, type Tuning } from "../physics/tuning.js";
import type { Rect, Faces } from "../physics/terrain.js";
import { SOLID_ALL } from "../physics/terrain.js";
import type { RuleSpec } from "../behavior/types.js";

export interface BlockSpec {
  id: string;
  x: number; y: number; w: number; h: number;        // 타일 단위 아님: px (에디터가 변환)
  faces?: Faces;                                       // 충돌면 (§44)
  shape?: "rect" | "slopeNE" | "slopeNW" | "ceilNE" | "ceilNW";
  properties?: { type: string; [k: string]: unknown }[]; // 표면 물성·접촉효과 (§properties)
  visibility?: "always" | "hidden" | "blink";          // 실체화
  blinkMs?: number;
  switchReact?: { mode: "show" | "motion"; whenOn: boolean } | null;  // §42
  rules?: RuleSpec[];                                   // 이동 (behavior 통합)
  breakBy?: { headbutt?: boolean; pound?: boolean; shell?: boolean; explosion?: boolean }; // §44 파괴
  emitsItem?: { assets: string[]; random: boolean } | null;  // 물음표 (§61 에셋 참조)
  pushable?: "none" | "byPlayer";                       // 밀기 관계 (유저가 밈 = 서버권위)
  seesaw?: boolean;                                     // 서버 권위 특수 (§44-1)
}

// "reappearing" = 파괴 재생성 유예(비충돌·점멸) — 등장 직후 즉시 재파괴/재이용되는 것 방지(§부활유예).
export type BlockState = "active" | "broken" | "reappearing" | "hiddenWaiting" | "fading";

export interface BlockInstance {
  spec: BlockSpec;
  state: BlockState;
  respawnLeftMs: number;
  graceLeftMs: number;       // "reappearing" 유예 잔여시간
  emptied: boolean;          // 물음표 소진 (빈 블록화)
  x: number; y: number;      // 이동 블록의 현재 위치 (좌상단)
  mem: Record<string, number>;
}

export function createBlock(spec: BlockSpec): BlockInstance {
  return {
    spec,
    state: spec.visibility === "hidden" ? "hiddenWaiting" : "active",
    respawnLeftMs: 0, graceLeftMs: 0, emptied: false,
    x: spec.x, y: spec.y, mem: {},
  };
}

/** 이 블록이 지금 충돌에 참여하나 (스위치·점멸·파괴 반영) */
export function blockSolid(b: BlockInstance, switchOn: boolean, nowMs: number): boolean {
  if (b.state !== "active") return false;
  const s = b.spec;
  if (s.switchReact && s.switchReact.mode === "show") {
    if (switchOn !== s.switchReact.whenOn) return false;
  }
  if (s.visibility === "blink") {
    const period = s.blinkMs ?? 2000;
    if (Math.floor(nowMs / period) % 2 === 1) return false;
  }
  return true;
}

/** 현재 Rect (지형 조회용) */
export function blockRect(b: BlockInstance): Rect {
  return { x: b.x, y: b.y, w: b.spec.w, h: b.spec.h, faces: b.spec.faces ?? SOLID_ALL };
}

/** 파괴 시도 (트리거 시점만 relay §35-I). 성공 시 재생성 타이머 시작 */
export function tryBreak(b: BlockInstance, by: "headbutt" | "pound" | "shell" | "explosion", t: Tuning = TUNING): boolean {
  if (b.state !== "active" || !b.spec.breakBy?.[by]) return false;
  b.state = "broken";
  b.respawnLeftMs = t.rules.respawnMs;
  return true;
}

/**
 * 매 틱 재생성 타이머 (§45). broken → reappearing(비충돌·점멸 유예) → active.
 * 반환값 true = 이 틱에 완전히 active로 복귀(재생성 완료 사운드/이펙트 트리거용).
 */
export function stepBlockRespawn(b: BlockInstance, dtMs: number, t: Tuning = TUNING): boolean {
  if (b.state === "broken") {
    b.respawnLeftMs -= dtMs;
    if (b.respawnLeftMs <= 0) { b.state = "reappearing"; b.graceLeftMs = t.rules.blockReappearMs; }
    return false;
  }
  if (b.state === "reappearing") {
    b.graceLeftMs -= dtMs;
    if (b.graceLeftMs <= 0) { b.state = "active"; return true; }
  }
  return false;
}
