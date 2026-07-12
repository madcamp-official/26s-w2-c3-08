// 잠복·출현 토글 (두더지)
import { registerAction } from "../registry.js";
registerAction("ambush", () => (ctx) => {
  const hidden = (ctx.mem["__hidden"] ?? 1) === 1;
  ctx.mem["__hidden"] = hidden ? 0 : 1;
  ctx.emit(hidden ? "emerge" : "hide", {});
}, { anim: { windup: "windup.generic", active: "move" }, sound: { start: "emerge" } });
