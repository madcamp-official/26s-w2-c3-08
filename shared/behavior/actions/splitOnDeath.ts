// 분열 (거대 굼바)
import { registerAction } from "../registry.js";
registerAction("splitOnDeath", (p) => (ctx) => {
  ctx.emit("split", { count: typeof p.count === "number" ? p.count : 2, child: p.child });
});
