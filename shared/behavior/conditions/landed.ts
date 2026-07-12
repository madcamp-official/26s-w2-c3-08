import { registerCondition } from "../registry.js";
registerCondition("landed", () => (ctx) => ctx.events.has("landed"));
