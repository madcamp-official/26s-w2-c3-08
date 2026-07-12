// 근접 감지: 반경 / x축 정렬 / y축 정렬 (§52 B)
import { registerCondition } from "../registry.js";
import { dist, distPreset } from "../helpers.js";
registerCondition("playerWithin", (p) => (ctx) => {
  if (!ctx.target) return false;
  const d = distPreset(p.dist, ctx.t);
  const axis = p.axis ?? "radius";
  if (axis === "x") return Math.abs(ctx.target.x - ctx.self.x) < d;
  if (axis === "y") return Math.abs(ctx.target.y - ctx.self.y) < d;
  return dist(ctx.self, ctx.target) < d;
});
