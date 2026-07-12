import { registerCondition } from "../registry.js";
registerCondition("stomped", () => (ctx) => ctx.events.has("stomped"));
