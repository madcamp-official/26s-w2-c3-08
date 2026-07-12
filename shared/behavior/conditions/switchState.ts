// 라인 스위치 ON/OFF (§47)
import { registerCondition } from "../registry.js";
registerCondition("switchState", (p) => (ctx) => ctx.switchOn === (p.on !== false));
