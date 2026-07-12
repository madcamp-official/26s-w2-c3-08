import { registerAction } from "../registry.js";
import { speedPreset } from "../helpers.js";
registerAction("flee", (p) => (ctx) => {
  if (!ctx.target) return;
  ctx.self.facing = ctx.target.x >= ctx.self.x ? -1 : 1;
  ctx.self.vx = ctx.self.facing * speedPreset(p.speed, ctx.t) * 0.6;
}, { anim: { active: "move" } });
