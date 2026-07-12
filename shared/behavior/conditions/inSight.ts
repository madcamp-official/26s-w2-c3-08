// 시야: 플레이어가 나를 보고 있는가 (facing 근사, §51 규율)
import { registerCondition } from "../registry.js";
registerCondition("inSight", (p) => (ctx) => {
  if (!ctx.target) return false;
  const looking = (ctx.target.facing === 1 && ctx.target.x < ctx.self.x)
    || (ctx.target.facing === -1 && ctx.target.x > ctx.self.x);
  return p.seen === false ? !looking : looking;
});
