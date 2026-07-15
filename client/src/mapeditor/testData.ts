// 배치 테스트용 더미 에셋 카드 — 실제 에셋 파이프라인 연동 전 UI 검증 전용.
// (임시방편입니다 — 실제 에셋 목록/썸네일로 교체 예정)
import type { Category } from "shared/schemas";

/** UI 필터용 그룹 — "블록"은 장치(obstacle)+지형(platform) 통합 (2026-07-14 확정) */
export type CardGroup = "block" | "monster" | "item" | "background";

export const GROUP_LABEL: Record<CardGroup, string> = {
  block: "블록",
  monster: "적군",
  item: "아이템",
  background: "배경",
};
export const GROUPS: CardGroup[] = ["block", "monster", "item", "background"];

/** 카테고리 대표색(2026-07-15, 임의 지정 — 카드 배경에 옅은 반투명으로 사용) */
export const CATEGORY_COLOR: Record<CardGroup, string> = {
  block: "#4A90D9",
  monster: "#D9534F",
  item: "#E0B400",
  background: "#4CAF50",
};

/** 카테고리 아이콘(모서리 표시 — 실제 에셋 이미지 전까지 자리표시) */
export const CATEGORY_ICON: Record<CardGroup, string> = {
  block: "■",
  monster: "◆",
  item: "★",
  background: "▲",
};

export const CATEGORY_TO_GROUP: Partial<Record<Category, CardGroup>> = {
  obstacle: "block",
  platform: "block",
  monster: "monster",
  item: "item",
  background: "background",
};

export interface PlaceholderCard {
  id: string;
  /** 실제 스키마 카테고리(장치=obstacle/지형=platform도 구분 보존, UI에선 group으로만 필터) */
  category: Category;
  group: CardGroup;
  label: string;
  /** 내가 만든(true) / 남이 만든(공용, false) */
  mine: boolean;
}

// 그룹별 6개씩(2026-07-14 지시 — 3개는 테스트하기엔 너무 적음) — 소유자는 섞어서 필터 테스트
const LETTERS = ["A", "B", "C", "D", "E", "F"];
function buildGroup(prefix: string, group: CardGroup, category: Category, labelBase: string): PlaceholderCard[] {
  return LETTERS.map((L, i) => ({
    id: `${prefix}${i + 1}`,
    category,
    group,
    label: `${labelBase}${L}`,
    mine: i % 2 === 0,
  }));
}

export const WAREHOUSE_CARDS: PlaceholderCard[] = [
  ...buildGroup("blk", "block", "obstacle", "블록"),
  ...buildGroup("mon", "monster", "monster", "적군"),
  ...buildGroup("itm", "item", "item", "아이템"),
  ...buildGroup("bg", "background", "background", "배경"),
];
