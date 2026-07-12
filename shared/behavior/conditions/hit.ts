import { registerCondition } from "../registry.js";
registerCondition("hit", () => (ctx) => ctx.events.has("hit"));
