// 플레이어 점프 동기화 (스킵스퀵) — 타깃이 상승 시작
import { registerCondition } from "../registry.js";
registerCondition("playerJumped", () => (ctx) =>
  ctx.target !== null && ctx.target.vy < -50 && !ctx.target.grounded);
