import { registerAction } from "../registry.js";
registerAction("hop", (p) => (ctx) => {
  if (!ctx.self.grounded) return;
  ctx.self.vy = typeof p.vy === "number" ? p.vy : -560;
  if (p.forward) ctx.self.vx = ctx.self.facing * 160;
}, { anim: { windup: "windup.generic", active: "onair" }, sound: { start: "hop" } });
