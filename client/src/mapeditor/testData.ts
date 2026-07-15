// 창고 카드 — 실제 DB 에셋(server GET /api/assets) 조회. 더미 픽스처는 폐기(2026-07-16).
import type { Category } from "shared/schemas";
import { HTTP_BASE } from "../net/rest.js";

/** UI 필터용 그룹 — "블록"은 장치(obstacle)+지형(platform) 통합 (2026-07-14 확정) */
export type CardGroup = "block" | "monster" | "item" | "background";

export const GROUP_LABEL: Record<CardGroup, string> = {
  block: "블록",
  monster: "적군",
  item: "아이템",
  background: "배경",
};
export const GROUPS: CardGroup[] = ["block", "monster", "item", "background"];

export const CATEGORY_TO_GROUP: Partial<Record<Category, CardGroup>> = {
  block: "block",
  monster: "monster",
  item: "item",
  background: "background",
};

export interface PlaceholderCard {
  id: string;
  /** 실제 스키마 카테고리(UI에선 group으로만 필터) */
  category: Category;
  group: CardGroup;
  label: string;
  /** 내가 만든(true) / 남이 만든(공용, false) */
  mine: boolean;
  /** 타일 크기 — widthCells/heightCells 그대로 */
  w: number;
  h: number;
  /** 원본 그림(투명 배경 PNG) — 없으면 카드가 카테고리색 폴백으로 표시 */
  sourceImageUrl: string | null;
}

interface AssetListRow {
  id: string;
  name: string;
  category: Category;
  mine: boolean;
  w: number;
  h: number;
  sourceImageUrl: string | null;
}

/** GET /api/assets — DB에 실재하는 배치 가능 에셋(block/monster/item/background) 전부 조회. */
export async function fetchWarehouseCards(): Promise<PlaceholderCard[]> {
  const res = await fetch(`${HTTP_BASE}/api/assets`);
  if (!res.ok) return [];
  const rows = (await res.json()) as AssetListRow[];
  return rows
    .filter((r) => r.category in CATEGORY_TO_GROUP)
    .map((r) => ({
      id: r.id,
      category: r.category,
      group: CATEGORY_TO_GROUP[r.category]!,
      label: r.name,
      mine: r.mine,
      w: r.w,
      h: r.h,
      sourceImageUrl: r.sourceImageUrl,
    }));
}
