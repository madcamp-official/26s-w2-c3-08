// 순간이동 (마귀공): 목적지는 선딜 시작 시 서버 확정 — mem에 예약 가능
import { registerAction } from "../registry.js";
registerAction("teleportTo", (p) => (ctx) => {
  const range = typeof p.range === "number" ? p.range : 256;
  const tx = ctx.mem["__tpX"] ?? ctx.self.x + (ctx.rng() * 2 - 1) * range;
  const ty = ctx.mem["__tpY"] ?? ctx.self.y;
  ctx.self.x = tx; ctx.self.y = ty; ctx.self.vx = 0; ctx.self.vy = 0;
  delete ctx.mem["__tpX"]; delete ctx.mem["__tpY"];
  ctx.emit("teleported", {});
}, { anim: { windup: "windup.teleport" }, sound: { start: "teleport" } });
