import { registerCondition } from "../registry.js";
registerCondition("atWall", () => (ctx) => ctx.self.touchingWall !== 0);
