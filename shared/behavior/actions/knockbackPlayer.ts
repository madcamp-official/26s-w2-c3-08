// 넉백 부여 (불리) — 실제 적용은 당하는 클라
import { registerAction } from "../registry.js";
registerAction("knockbackPlayer", () => (ctx) => {
  ctx.emit("knockback", { x: ctx.self.x, fromFacing: ctx.self.facing });
}, { sound: { start: "bump" } });
