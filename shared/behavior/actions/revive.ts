// 부활 (드라이본)
import { registerAction } from "../registry.js";
registerAction("revive", () => (ctx) => {
  delete ctx.mem["__stunLeft"];
  ctx.emit("revived", {});
}, { anim: { active: "idle" }, sound: { start: "revive" } });
