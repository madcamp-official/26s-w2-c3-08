// 위에 플레이어가 서 있는가 (라이드/접촉반응 트리거용). self는 블록 바디(바닥-중앙 앵커, top=상면)
import { registerCondition } from "../registry.js";
registerCondition("ridden", () => (ctx) => {
  const topY = ctx.self.y - ctx.self.h;
  return ctx.players.some((p) => {
    const withinX = Math.abs(p.x - ctx.self.x) < (ctx.self.w + p.w) / 2;
    const onTop = p.grounded && Math.abs(p.y - topY) < 6;
    return withinX && onTop;
  });
});
