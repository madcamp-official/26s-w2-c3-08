import { registerAction } from "../registry.js";
import { speedPreset } from "../helpers.js";
registerAction("walk", (p) => (ctx) => {
  ctx.self.vx = ctx.self.facing * speedPreset(p.speed, ctx.t) * 0.5;
}, { anim: { active: "move" } });
