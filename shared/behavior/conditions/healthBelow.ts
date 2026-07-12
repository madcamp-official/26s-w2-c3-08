// 체력 비율 임계 이하 (HP 집합 기반)
import { registerCondition } from "../registry.js";
registerCondition("healthBelow", (p) => (ctx) =>
  ctx.hpRatio <= (typeof p.ratio === "number" ? p.ratio : 0.5));
