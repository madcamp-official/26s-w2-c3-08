// 부유·비행: 중력 off, 타깃 방향(또는 직진) 자유 이동
import { registerAction } from "../registry.js";
import { speedPreset } from "../helpers.js";
registerAction("fly", (p) => (ctx) => {
  const s = ctx.self; s.gravity = false;
  const v = speedPreset(p.speed, ctx.t) * 0.4;
  if (p.chase && ctx.target) {
    const dx = ctx.target.x - s.x;
    const dy = (ctx.target.y - ctx.target.h / 2) - (s.y - s.h / 2);
    const m = Math.hypot(dx, dy) || 1;
    s.vx = (dx / m) * v; s.vy = (dy / m) * v; s.facing = dx >= 0 ? 1 : -1;
  } else {
    if (s.touchingWall === s.facing) s.facing = (-s.facing) as 1 | -1;
    s.vx = s.facing * v; s.vy = 0;
  }
}, { anim: { active: "move" } });
