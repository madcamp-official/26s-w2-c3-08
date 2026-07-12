// 접촉 즉사
import { registerProperty } from "./registry.js";
registerProperty("instakill", {
  onTouch: (other, _r, side, _t, p) => {
    const part = p.part ?? "all";
    if (part === "notTop" && side === "top") return;
    if (part === "bottomOnly" && side !== "bottom") return;
    (other as { __die?: boolean }).__die = true;
  },
  slots: { sound: { start: "die" } },
});
