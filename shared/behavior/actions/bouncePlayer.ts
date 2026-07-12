// 튕김 부여 (홉챱)
import { registerAction } from "../registry.js";
registerAction("bouncePlayer", () => (ctx) => {
  ctx.emit("bounce", { x: ctx.self.x, y: ctx.self.y });
}, { sound: { start: "boing" } });
