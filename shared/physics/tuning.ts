// tuning.json 로더. 모든 조작감·게임 수치의 유일한 원천 (코드 하드코딩 금지).
import raw from "./tuning.json" with { type: "json" };

export type Tuning = typeof raw;
export const TUNING: Tuning = raw;

/** 개발용 런타임 튜닝: "jump.velocity" 경로의 숫자를 덮어씀. 성공 여부 반환 */
export function applyTuning(path: string, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const keys = path.split(".");
  let obj: Record<string, unknown> = TUNING as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) {
    const next = obj[k];
    if (typeof next !== "object" || next === null) return false;
    obj = next as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (typeof obj[last] !== "number") return false;
  obj[last] = value;
  return true;
}
