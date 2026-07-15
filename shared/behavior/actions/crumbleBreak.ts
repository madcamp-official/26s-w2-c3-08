// 밟으면 일정 시간 후 파괴 — crumbleFall과 동일 타이밍, 결과만 다름(즉시 소멸 vs 낙하 느낌).
import { registerAction } from "../registry.js";
const DELAY_MS = 500;
registerAction("crumbleBreak", () => (ctx) => {
  const k = "__crumbleMs";
  const before = ctx.mem[k] ?? 0;
  if (before === 0) ctx.emit("crumbleStart", {});
  const now = before + ctx.dtMs;
  if (now >= DELAY_MS) { ctx.emit("crumbleBreak", {}); ctx.mem[k] = 0; }
  else ctx.mem[k] = now;
}, { sound: { start: "crumble" } });
