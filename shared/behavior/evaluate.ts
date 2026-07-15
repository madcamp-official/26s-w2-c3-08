// 매 틱 규칙 평가: 참인 규칙 → 최고 우선순위 → 동순위면 랜덤(§51).
// 선딜(windupMs)이 있는 행동은 예약 상태를 mem에 저장하고 시간이 되면 실행(§23).
import type { Ctx, RuleSpec, Condition, Action } from "./types.js";
import { buildCondition, buildAction } from "./registry.js";

export interface CompiledRule {
  when: Condition;
  act: Action;
  priority: number;
  windupMs: number;
  id: number;
  /** 행동 종류 이름(spec.do.type) — 패턴별 사운드/연출 식별용(§actionChanged) */
  type: string;
}

export function compileRules(specs: RuleSpec[]): CompiledRule[] {
  return specs.map((s, i) => ({
    when: buildCondition(s.when),
    act: buildAction(s.do),
    priority: s.priority ?? 0,
    windupMs: s.windupMs ?? 0,
    id: i,
    type: s.do.type,
  }));
}

/**
 * 규칙 실행. mem["__windupRule"]/["__windupLeft"]로 선딜 진행을 추적.
 * 선딜 중에는 다른 규칙을 안 고른다(예비 동작 = 커밋).
 */
export function stepRules(rules: CompiledRule[], ctx: Ctx): void {
  // 선딜 진행 중이면 카운트다운 → 완료 시 실행
  const windupRule = ctx.mem["__windupRule"];
  if (windupRule !== undefined && windupRule >= 0) {
    ctx.mem["__windupLeft"] = (ctx.mem["__windupLeft"] ?? 0) - ctx.dtMs;
    if (ctx.mem["__windupLeft"] <= 0) {
      ctx.mem["__windupRule"] = -1;
      rules[windupRule]?.act(ctx);
      ctx.events.add("actionDone");
    }
    return;
  }

  const active = rules.filter((r) => r.when(ctx));
  if (active.length === 0) return;
  const maxP = Math.max(...active.map((r) => r.priority));
  const top = active.filter((r) => r.priority === maxP);
  const chosen = top.length === 1 ? top[0] : top[Math.floor(ctx.rng() * top.length)];

  // 선택된 행동이 바뀐 순간(=패턴 전환)만 1회 통지 — 매 틱 반복 실행과는 별개(§actionChanged, 사운드/연출용)
  if (ctx.mem["__lastActionId"] !== chosen.id) {
    ctx.mem["__lastActionId"] = chosen.id;
    ctx.emit("actionChanged", { type: chosen.type, ruleId: chosen.id });
  }

  if (chosen.windupMs > 0) {
    ctx.mem["__windupRule"] = chosen.id;
    ctx.mem["__windupLeft"] = chosen.windupMs;
    ctx.emit("windup", { ruleId: chosen.id, ms: chosen.windupMs });
    return;
  }
  chosen.act(ctx);
}
