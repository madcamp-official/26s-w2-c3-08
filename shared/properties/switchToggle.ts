// 접촉 시 라인 스위치 토글 (능동 스위치, §44). 상태 확정은 서버(§47)
import { registerProperty } from "./registry.js";
registerProperty("switchToggle", {
  onTouch: (other, _r, _side, _t, _p) => {
    (other as { __toggleSwitch?: boolean }).__toggleSwitch = true;
  },
  slots: { sound: { start: "switch" } },
});
