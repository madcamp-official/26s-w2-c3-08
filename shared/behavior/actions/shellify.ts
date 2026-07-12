// 껍질화 (엉금): 자신 제거 + 껍질 생성 요청
import { registerAction } from "../registry.js";
registerAction("shellify", () => (ctx) => {
  ctx.emit("shellify", { x: ctx.self.x, y: ctx.self.y });
}, { sound: { start: "shell" } });
