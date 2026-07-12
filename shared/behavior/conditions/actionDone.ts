import { registerCondition } from "../registry.js";
registerCondition("actionDone", () => (ctx) => ctx.events.has("actionDone"));
