// 상승기류: 영역 접촉 시 위로 밀어올림 (무해)
import { registerProperty } from "./registry.js";
registerProperty("updraft", {
  onTouch: (other, _r, _s, _t, p) => {
    const lift = typeof p.lift === "number" ? p.lift : 1800;
    other.vy -= lift * (1 / 60);
  },
});
