// 낙하 돌진 (쿵쿵)
import { registerAction } from "../registry.js";
registerAction("slamDown", (p) => (ctx) => {
  ctx.self.vx = 0;
  ctx.self.vy = typeof p.vy === "number" ? p.vy : ctx.t.pound.fallVelocity;
}, { anim: { windup: "windup.slam", active: "fall.slam" }, sound: { impact: "slam_hit" } });
