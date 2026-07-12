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

/** 원인 갱신: 매 프레임 원인 있으면 set, 없으면 기본값 복귀 */
export function setSquash(s: SquashState, kind: "none" | "stomped" | "pushed" | "ceil", dir = 1): void {
  switch (kind) {
    case "stomped": s.targetSx = 1.15; s.targetSy = 0.7; s.targetOx = 0; s.targetOy = 0; break;
    case "pushed": s.targetSx = 0.8; s.targetSy = 1.05; s.targetOx = dir * 8; s.targetOy = 0; break;
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
