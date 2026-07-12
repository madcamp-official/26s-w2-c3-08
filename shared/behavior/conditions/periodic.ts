// 주기 n초마다 한 틱 참
import { registerCondition } from "../registry.js";
registerCondition("periodic", (p) => {
  const ms = typeof p.ms === "number" ? p.ms : 2000;
  return (ctx) => {
    const k = "__period" + ms;
    ctx.mem[k] = (ctx.mem[k] ?? 0) + ctx.dtMs;
    if (ctx.mem[k] >= ms) { ctx.mem[k] = 0; return true; }
    return false;
  };
});
