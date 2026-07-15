// 밟으면 끝점으로 주행(ride_start). 안 밟으면 멈춤(§A-3 단순화 — 원작처럼 중간에 내려도 계속 가진 않음)
import { registerAction } from "../registry.js";
import { speedPreset } from "../helpers.js";
registerAction("shuttle", (p) => (ctx) => {
  const endX = typeof p.endX === "number" ? p.endX : ctx.self.x;
  const endY = typeof p.endY === "number" ? p.endY : ctx.self.y;
  const dx = endX - ctx.self.x, dy = endY - ctx.self.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) { ctx.self.vx = 0; ctx.self.vy = 0; return; }
  const speed = speedPreset(p.speed, ctx.t) * 0.5;
  ctx.self.vx = (dx / dist) * speed;
  ctx.self.vy = (dy / dist) * speed;
}, { sound: { start: "boing" } });
