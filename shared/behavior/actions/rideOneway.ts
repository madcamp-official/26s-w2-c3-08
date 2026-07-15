// 밟으면 끝점으로 주행 + 도착 후 sink 옵션이면 서서히 가라앉음(ride_oneway)
import { registerAction } from "../registry.js";
import { speedPreset } from "../helpers.js";
registerAction("rideOneway", (p) => (ctx) => {
  const endX = typeof p.endX === "number" ? p.endX : ctx.self.x;
  const endY = typeof p.endY === "number" ? p.endY : ctx.self.y;
  const dx = endX - ctx.self.x, dy = endY - ctx.self.y;
  const dist = Math.hypot(dx, dy);
  const speed = speedPreset(p.speed, ctx.t) * 0.5;
  if (dist > 4) {
    ctx.self.vx = (dx / dist) * speed;
    ctx.self.vy = (dy / dist) * speed;
  } else {
    ctx.self.vx = 0;
    ctx.self.vy = p.sink ? speed * 0.3 : 0;
  }
}, { sound: { start: "boing" } });
