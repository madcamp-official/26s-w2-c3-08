// 컨베이어: 위에 선 대상을 방향으로 밀어냄 (지형이 유저를 밈)
import { registerProperty } from "./registry.js";
registerProperty("conveyor", {
  onStand: (other, _t, p) => {
    const dir = p.dir === "left" ? -1 : 1;
    const v = typeof p.speed === "number" ? p.speed : 80;
    other.x += dir * v * (1 / 60);
  },
  slots: { anim: { active: "surface.belt" } },
});
