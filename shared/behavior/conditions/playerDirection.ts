// 플레이어가 나의 위/아래/좌/우에 있는가
import { registerCondition } from "../registry.js";
registerCondition("playerDirection", (p) => (ctx) => {
  if (!ctx.target) return false;
  const dir = p.dir;
  if (dir === "above") return ctx.target.y < ctx.self.y - ctx.self.h;
  if (dir === "below") return ctx.target.y > ctx.self.y;
  if (dir === "left") return ctx.target.x < ctx.self.x;
  return ctx.target.x > ctx.self.x;
});
