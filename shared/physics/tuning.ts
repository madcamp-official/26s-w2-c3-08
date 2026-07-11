// tuning.json 로더. 조작감 수치의 유일한 원천은 tuning.json이다.
// (esbuild 계열인 tsx/Vite 모두 JSON import를 지원한다)

import raw from "./tuning.json" with { type: "json" };

export type Tuning = typeof raw;
export const TUNING: Tuning = raw;

/**
 * 개발용 런타임 튜닝. "jump.velocity" 같은 경로의 숫자 값을 덮어쓴다.
 * TUNING 싱글턴을 직접 변형하므로 서버·클라 각자 실행해야 동기화된다
 * (baseworld의 tune 메시지가 그 역할). 성공 여부를 반환.
 */
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
