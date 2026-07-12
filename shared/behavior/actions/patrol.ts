// 왕복: 벽·(옵션)절벽에서 방향 전환
import { registerAction } from "../registry.js";
import { speedPreset } from "../helpers.js";
import { canStandAt } from "../../physics/body.js";
registerAction("patrol", (p) => (ctx) => {
  const s = ctx.self;
  if (s.touchingWall === s.facing) s.facing = (-s.facing) as 1 | -1;
  if (p.turnAtLedge && s.grounded) {
    const probe = { ...s, x: s.x + s.facing * s.w * 0.6, y: s.y + 8 };
    if (canStandAt(probe, ctx.terrain, s.h, ctx.t)) s.facing = (-s.facing) as 1 | -1;
  }
  s.vx = s.facing * speedPreset(p.speed, ctx.t) * 0.5;
}, { anim: { active: "move" } });
