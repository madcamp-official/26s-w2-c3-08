// 포물선 부유 (라바버블): 주기적으로 솟았다 중력 낙하
import { registerAction } from "../registry.js";
registerAction("lavaBounce", (p) => (ctx) => {
  const s = ctx.self; s.gravity = true;
  const home = ctx.mem["__lavaHome"] ?? (ctx.mem["__lavaHome"] = s.y);
  if (s.vy >= 0 && (s.grounded || s.y >= home)) {
    s.vy = typeof p.vy === "number" ? p.vy : -900;
  }
}, { anim: { active: "onair" } });
