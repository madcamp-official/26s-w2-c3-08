import { registerCondition } from "../registry.js";
registerCondition("always", () => () => true);
