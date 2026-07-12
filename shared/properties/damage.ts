// 접촉 피해 — 실제 판정은 당하는 클라(§14). emit은 파트 계층에서
import { registerProperty } from "./registry.js";
registerProperty("damage", {
  onTouch: (other, _r, side, _t, p) => {
    const part = p.part ?? "all";
    if (part === "notTop" && side === "top") return;
    if (part === "bottomOnly" && side !== "bottom") return;
    (other as { __takeDamage?: boolean }).__takeDamage = true;
  },
  slots: { sound: { start: "hurt" } },
});
