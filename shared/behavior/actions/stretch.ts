// 신축 (크리퍼)
import { registerAction } from "../registry.js";
registerAction("stretch", (p) => (ctx) => {
  const base = ctx.mem["__baseH"] ?? (ctx.mem["__baseH"] = ctx.self.h);
  const mult = typeof p.mult === "number" ? p.mult : 2;
  ctx.self.h = ctx.self.h > base ? base : base * mult;
}, { anim: { active: "move" } });
