// 아이템 attrs — asset-attributes.md §4 (2026-07-10 확정: 시스템 제공 2종만, 유저 제작 불가).
// Asset.isSystem=true 전용. 세부 상수(거대버섯 배율, 가속 지속시간)는 미확정 — shared/constants.ts에서 관리 예정.
import { z } from "zod";

export const ItemAttrs = z.object({
  v: z.literal(1),
  effect: z.enum(["giant_mushroom", "speed_boost"]), // 거대버섯(생명+1·크기 확대) / 가속
});
export type ItemAttrs = z.infer<typeof ItemAttrs>;
