// 밟으면 일정 시간 후 낙하(붕괴) — 도넛 블록. 발동 즉시 텔레그래프(crumbleStart) 1회,
// 유예(500ms) 후 crumbleFall 방출 — PhysicsRoom이 블록 상태를 broken으로 전이시킨다.
import { registerAction } from "../registry.js";
const DELAY_MS = 500;
registerAction("crumbleFall", () => (ctx) => {
  const k = "__crumbleMs";
  const before = ctx.mem[k] ?? 0;
  if (before === 0) ctx.emit("crumbleStart", {});
  const now = before + ctx.dtMs;
  if (now >= DELAY_MS) { ctx.emit("crumbleFall", {}); ctx.mem[k] = 0; }
  else ctx.mem[k] = now;
}, { sound: { start: "crumble" } });
