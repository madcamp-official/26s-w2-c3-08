// 벽·천장 기어가기 (1차: 벽 접촉 유지 단순형)
import { registerAction } from "../registry.js";
import { speedPreset } from "../helpers.js";
registerAction("crawlSurface", (p) => (ctx) => {
  const s = ctx.self; s.gravity = false;
  const v = speedPreset(p.speed, ctx.t) * 0.3;
  const dir = ctx.mem["__crawlDir"] ?? 1;
  if (s.touchingWall !== 0) { s.vy = dir * v; s.vx = s.touchingWall * 20; }
  else { s.vx = s.facing * v; s.vy = 20; }
  if (s.grounded || s.crushed) ctx.mem["__crawlDir"] = -dir;
}, { anim: { active: "move" } });
