// 발사: 발사체(에셋 참조) 생성 요청 — 실제 생성은 월드 계층
import { registerAction } from "../registry.js";
registerAction("shoot", (p) => (ctx) => {
  ctx.emit("shoot", {
    projectile: p.projectile ?? "default",
    trajectory: p.trajectory ?? "straight",
    aim: p.aim ?? "facing",
    speed: p.speed ?? "normal",
    x: ctx.self.x, y: ctx.self.y - ctx.self.h / 2, facing: ctx.self.facing,
    targetX: ctx.target ? ctx.target.x : undefined,
    targetY: ctx.target ? ctx.target.y - ctx.target.h / 2 : undefined,
  });
}, { anim: { windup: "windup.shoot", active: "idle" }, sound: { start: "shoot" } });
