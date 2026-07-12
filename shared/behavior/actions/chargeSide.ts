// 가로 돌진
import { registerAction } from "../registry.js";
import { speedPreset } from "../helpers.js";
registerAction("chargeSide", (p) => (ctx) => {
  const dir = ctx.target ? (ctx.target.x >= ctx.self.x ? 1 : -1) : ctx.self.facing;
  ctx.self.facing = dir as 1 | -1;
  ctx.self.vx = dir * speedPreset(p.speed ?? "fast", ctx.t);
}, { anim: { windup: "windup.generic", active: "move" }, sound: { start: "charge" } });
