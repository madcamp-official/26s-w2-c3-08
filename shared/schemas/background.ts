// 배경 attrs — asset-attributes.md §4.5. 충돌·트리거·이동 없음, z축 뒤 렌더링.
// 애니메이션: md 스냅샷은 "static 1장"이지만 팀 방침 갱신(2026-07-12) —
// 배경도 idle 루프(예: 잔디 흔들림) 생성 대상. actions/derive.ts 참조.
import { z } from "zod";
import { SizeCells } from "./presets.js";

export const BackgroundAttrs = z.object({
  v: z.literal(1),
  size: SizeCells,
});
export type BackgroundAttrs = z.infer<typeof BackgroundAttrs>;

export const defaultBackgroundAttrs = (): BackgroundAttrs => ({
  v: 1,
  size: { w: 1, h: 1 },
});
