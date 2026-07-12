import { registerAction } from "../registry.js";
registerAction("idle", () => (ctx) => { ctx.self.vx = 0; }, { anim: { active: "idle" } });
