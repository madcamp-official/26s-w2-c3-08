// 조건·행동 레지스트리. "옵션 하나 = 파일 하나 + 등록 한 줄" (§56).
// 각 conditions/*.ts, actions/*.ts 파일이 여기 register___()로 자기 등록한다.
import type { Condition, Action, CondSpec, ActSpec, SlotDecl } from "./types.js";

type CondFactory = (params: Record<string, unknown>) => Condition;
type ActFactory = (params: Record<string, unknown>) => Action;

const conditions = new Map<string, { make: CondFactory; slots?: SlotDecl }>();
const actions = new Map<string, { make: ActFactory; slots?: SlotDecl }>();

export function registerCondition(name: string, make: CondFactory, slots?: SlotDecl): void {
  conditions.set(name, { make, slots });
}
export function registerAction(name: string, make: ActFactory, slots?: SlotDecl): void {
  actions.set(name, { make, slots });
}

export function buildCondition(spec: CondSpec): Condition {
  // 복합조건 (AND/OR/NOT) — 조건 트리
  if (spec.type === "and") {
    const cs = (spec.of as CondSpec[]).map(buildCondition);
    return (ctx) => cs.every((c) => c(ctx));
  }
  if (spec.type === "or") {
    const cs = (spec.of as CondSpec[]).map(buildCondition);
    return (ctx) => cs.some((c) => c(ctx));
  }
  if (spec.type === "not") {
    const c = buildCondition(spec.of as CondSpec);
    return (ctx) => !c(ctx);
  }
  const e = conditions.get(spec.type);
  if (!e) throw new Error(`미등록 조건: ${spec.type}`);
  return e.make(spec);
}

export function buildAction(spec: ActSpec): Action {
  const e = actions.get(spec.type);
  if (!e) throw new Error(`미등록 행동: ${spec.type}`);
  return e.make(spec);
}

/** 파츠의 요구 애니·사운드 슬롯 합집합 (§64 — 생성 큐 입력) */
export function collectSlots(specs: { type: string }[]): SlotDecl {
  const anim: Record<string, string> = {};
  const sound: Record<string, string> = {};
  for (const s of specs) {
    const e = actions.get(s.type) ?? conditions.get(s.type);
    if (e?.slots?.anim) Object.assign(anim, e.slots.anim);
    if (e?.slots?.sound) Object.assign(sound, e.slots.sound);
  }
  return { anim, sound };
}

export function listConditions(): string[] { return [...conditions.keys()]; }
export function listActions(): string[] { return [...actions.keys()]; }
