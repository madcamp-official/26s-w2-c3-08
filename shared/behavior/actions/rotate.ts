// 제자리 회전 (파이어바류): 중심 기준 원호 이동
import { registerAction } from "../registry.js";
registerAction("rotate", (p) => (ctx) => {
  const s = ctx.self; s.gravity = false;
  const cx = ctx.mem["__cx"] ?? (ctx.mem["__cx"] = s.x);
  const cy = ctx.mem["__cy"] ?? (ctx.mem["__cy"] = s.y);
  const r = typeof p.radius === "number" ? p.radius : 96;
  const w = typeof p.angularSpeed === "number" ? p.angularSpeed : 2;
  const a = (ctx.mem["__angle"] = (ctx.mem["__angle"] ?? 0) + w * (ctx.dtMs / 1000));
  s.x = cx + Math.cos(a) * r; s.y = cy + Math.sin(a) * r; s.vx = 0; s.vy = 0;
});
