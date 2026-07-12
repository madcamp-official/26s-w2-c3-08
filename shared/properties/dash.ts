// 대시 블록: 밟으면 진행 방향 가속
import { registerProperty } from "./registry.js";
registerProperty("dash", {
  onStand: (other, t, p) => {
    const boost = typeof p.boost === "number" ? p.boost : t.run.runSpeed * 1.4;
    if (Math.abs(other.vx) < boost) other.vx = other.facing * boost;
  },
  slots: { sound: { start: "charge" } },
});
