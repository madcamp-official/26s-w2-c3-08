// 절벽 앞: 진행 방향 발밑에 지형 없음
import { registerCondition } from "../registry.js";
import { canStandAt } from "../../physics/body.js";
registerCondition("atLedge", () => (ctx) => {
  const probe = { ...ctx.self, x: ctx.self.x + ctx.self.facing * ctx.self.w * 0.6, y: ctx.self.y + 8 };
  return ctx.self.grounded && canStandAt(probe, ctx.terrain, ctx.self.h, ctx.t);
});
