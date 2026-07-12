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
export type SquashKind = "none" | "stomped" | "squeeze" | "shift" | "ceil";
export function setSquash(s: SquashState, kind: SquashKind, dir = 1, amount = 8): void {
  switch (kind) {
    case "stomped": s.targetSx = 1.15; s.targetSy = 0.7; s.targetOx = 0; s.targetOy = 0; break;
    case "squeeze": s.targetSx = 1 - amount; s.targetSy = 1 + amount * 0.25; s.targetOx = 0; s.targetOy = 0; break; // amount = 비율(0~1). 중심 대칭 스케일만(오프셋 0 → shift와 정확 대칭)
    case "shift": s.targetSx = 1; s.targetSy = 1; s.targetOx = dir * amount; s.targetOy = 0; break;
    case "ceil": s.targetSx = 1.1; s.targetSy = 0.8; s.targetOx = 0; s.targetOy = -6; break; // 위로 압축(§26-2)
    default: s.targetSx = 1; s.targetSy = 1; s.targetOx = 0; s.targetOy = 0;
  }
}

export function stepSquash(s: SquashState, lerp = 0.3): void {
  s.sx += (s.targetSx - s.sx) * lerp;
  s.sy += (s.targetSy - s.sy) * lerp;
  s.offsetX += (s.targetOx - s.offsetX) * lerp;
  s.offsetY += (s.targetOy - s.offsetY) * lerp;
}
