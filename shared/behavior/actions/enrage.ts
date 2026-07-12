// 분노 (꿈틀이)
import { registerAction } from "../registry.js";
registerAction("enrage", () => (ctx) => {
  ctx.mem["__enraged"] = 1;
  ctx.emit("enraged", {});
}, { anim: { active: "move.angry" }, sound: { start: "enrage" } });
