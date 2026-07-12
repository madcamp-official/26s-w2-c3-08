// 기절
import { registerAction } from "../registry.js";
registerAction("stunSelf", (p) => (ctx) => {
  ctx.mem["__stunLeft"] = typeof p.ms === "number" ? p.ms : 3000;
  ctx.self.vx = 0;
  ctx.emit("stunned", { ms: ctx.mem["__stunLeft"] });
}, { anim: { active: "stun" }, sound: { start: "stun" } });
