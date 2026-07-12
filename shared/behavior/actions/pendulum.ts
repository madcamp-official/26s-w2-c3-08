// 진자 스윙
import { registerAction } from "../registry.js";
registerAction("pendulum", (p) => (ctx) => {
  const s = ctx.self; s.gravity = false;
  const len = typeof p.length === "number" ? p.length : 128;
  const cx = ctx.mem["__px"] ?? (ctx.mem["__px"] = s.x);
  const cy = ctx.mem["__py"] ?? (ctx.mem["__py"] = s.y - len);
  const amp = typeof p.amplitude === "number" ? p.amplitude : 1.0;
  const period = typeof p.periodMs === "number" ? p.periodMs : 2400;
  const tt = (ctx.mem["__pt"] = (ctx.mem["__pt"] ?? 0) + ctx.dtMs);
  const a = Math.PI / 2 + Math.sin((tt / period) * Math.PI * 2) * amp;
  s.x = cx + Math.cos(a) * len; s.y = cy + Math.sin(a) * len; s.vx = 0; s.vy = 0;
});
