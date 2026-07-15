// 자기 변형 (§26): 무조건 연출·방향성·원인 지속=유지. 스프라이트에만 적용.
export interface SquashState {
  sx: number; sy: number;      // 현재 스케일
  targetSx: number; targetSy: number;
  offsetX: number; offsetY: number;   // 밀림 오프셋 (연출)
  targetOx: number; targetOy: number;
}

export function createSquash(): SquashState {
  return { sx: 1, sy: 1, targetSx: 1, targetSy: 1, offsetX: 0, offsetY: 0, targetOx: 0, targetOy: 0 };
}

/** 원인 갱신 (§26 정정 2026-07-12):
 *  - squeeze = 밀리는/밟히는 쪽: 찌부 (스케일)
 *  - shift   = 미는 쪽: 찌부되지 않고, 상대가 찌부된 만큼 그 방향으로 스프라이트만 이동 */
export type SquashKind = "none" | "stomped" | "squeeze" | "shift" | "ceil" | "bumpY";
// w = 찌부 대상 폭(px). 접촉면 앵커용 — 밀린 방향(dir)의 반대편 모서리를 고정하고 접촉면만 캐이게 함.
export function setSquash(s: SquashState, kind: SquashKind, dir = 1, amount = 8, w = 0): void {
  switch (kind) {
    case "stomped": s.targetSx = 1.15; s.targetSy = 0.7; s.targetOx = 0; s.targetOy = 0; break;
    // amount = 비율(0~1). offsetX = dir×(폭×비율÷2) → far 모서리 고정, 접촉(-dir)면이 폭×비율 전체만큼 캐임
    case "squeeze": s.targetSx = 1 - amount; s.targetSy = 1 + amount * 0.25; s.targetOx = dir * (w * amount / 2); s.targetOy = 0; break;
    case "shift": s.targetSx = 1; s.targetSy = 1; s.targetOx = dir * amount; s.targetOy = 0; break;
    case "ceil": s.targetSx = 1.1; s.targetSy = 0.8; s.targetOx = 0; s.targetOy = -6; break; // 위로 압축(§26-2)
    // 블록 "띠용": 히트박스 불변(스케일 그대로), 스프라이트만 충격 반대방향으로 잠깐 이동(§B4)
    case "bumpY": s.targetSx = 1; s.targetSy = 1; s.targetOx = 0; s.targetOy = dir * amount; break;
    default: s.targetSx = 1; s.targetSy = 1; s.targetOx = 0; s.targetOy = 0;
  }
}

export function stepSquash(s: SquashState, lerp = 0.3): void {
  s.sx += (s.targetSx - s.sx) * lerp;
  s.sy += (s.targetSy - s.sy) * lerp;
  s.offsetX += (s.targetOx - s.offsetX) * lerp;
  s.offsetY += (s.targetOy - s.offsetY) * lerp;
}

/** 감쇠 스프링 1축(§B2 웅크림 등 "누르는 동안 지속 + 전환에 오버슈트" 연출용).
 *  lerp(stepSquash)와 달리 목표를 살짝 넘쳤다가 되돌아오는 "띠용" 느낌을 낸다. */
export interface SpringState { v: number; vel: number }
export function createSpring(v = 1): SpringState { return { v, vel: 0 }; }
export function stepSpring(s: SpringState, target: number, dtSec: number, stiffness = 700, damping = 22): void {
  const accel = stiffness * (target - s.v) - damping * s.vel;
  s.vel += accel * dtSec;
  s.v += s.vel * dtSec;
}
