// 넉백 범퍼: 무해하게 접촉면 반대 방향으로 밀어냄 (§knockback, buildRuntimePart TODO 해소)
import { registerProperty } from "./registry.js";
registerProperty("knockback", {
  onTouch: (other, _r, side, _t, p) => {
    const power = typeof p.power === "number" ? p.power : 800;
    switch (side) {
      case "top": other.vy = -power; break;
      case "bottom": other.vy = power; break;
      case "left": other.vx = -power; break;
      case "right": other.vx = power; break;
    }
  },
  slots: { sound: { start: "bump" } },
});
