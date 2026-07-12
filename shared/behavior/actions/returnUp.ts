// 원위치 복귀 (쿵쿵 상승)
import { registerAction } from "../registry.js";
registerAction("returnUp", (p) => (ctx) => {
  const s = ctx.self;
  const home = ctx.mem["__homeY"] ?? (ctx.mem["__homeY"] = s.y);
  s.gravity = false;
  if (s.y > home) { s.vy = -(typeof p.speed === "number" ? p.speed : 120); }
  else { s.vy = 0; s.y = home; s.gravity = true; ctx.events.add("actionDone"); }
}, { anim: { active: "move" } });
