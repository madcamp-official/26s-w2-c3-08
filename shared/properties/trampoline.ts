// 트램펄린: 위에서 밟으면 튕김
import { registerProperty } from "./registry.js";
registerProperty("trampoline", {
  onTouch: (other, _r, side, _t, p) => {
    if (side !== "top") return;
    other.vy = typeof p.power === "number" ? -p.power : -900;
  },
  slots: { anim: { active: "surface.spring" }, sound: { start: "boing" } },
});
