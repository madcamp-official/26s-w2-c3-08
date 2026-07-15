// 주기의 전반부 동안 지속 참(§트리거 게이팅용) — periodic(단발 펄스)과 달리 이동 등
// 지속 행동을 "주기적으로 활성/비활성"시키는 데 쓴다(예: 블록 trigger:periodic).
import { registerCondition } from "../registry.js";
registerCondition("periodicWindow", (p) => {
  const ms = typeof p.ms === "number" ? p.ms : 2000;
  return (ctx) => {
    const k = "__periodWindow" + ms;
    ctx.mem[k] = (ctx.mem[k] ?? 0) + ctx.dtMs;
    if (ctx.mem[k] >= ms) ctx.mem[k] -= ms;
    return ctx.mem[k] < ms / 2;
  };
});
