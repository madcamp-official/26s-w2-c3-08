// 공용 풀 "보장 포함" 규칙 — 카테고리별 랜덤 제한과 무관하게, 특정 옵션을 가진 공용 에셋 중
// 최소 1개를 매 게임 풀에 반드시 넣는다. (스위치 없으면 스위치 연동 에셋이 무의미해지므로)
// 확장: 새 규칙 = 이 배열에 한 줄. 지금은 스위치만.
//
// 실제 풀 구성 코드(방 시작 시 랜덤 선택)는 아직 미구현 — 그 빌더가 이 규칙들을 소비하게 된다:
//   각 규칙마다 matches를 만족하는 공용 에셋을 최소 1개 확보한 뒤, 나머지를 카테고리 제한대로 랜덤 채움.
import type { AttrsByCategory, Category } from "../schemas/index.js";

export interface GuaranteedRule {
  id: string;
  label: string;
  /** 이 규칙이 보장하려는 에셋인가 (category+attrs 판정) */
  matches: (category: Category, attrs: unknown) => boolean;
}

/**
 * 매 게임 카테고리별 랜덤 공용 제공 개수. (2026-07-14)
 * background = 예외(무제한, 여기 없음) · avatar = 맵 배치 대상 아님 · item = 미정(TBD).
 * 보장 포함(GUARANTEED_POOL_RULES)은 이 개수와 별도로 먼저 확보.
 */
export const RANDOM_POOL_COUNTS: Partial<Record<Category, number>> = {
  block: 30,
  monster: 10,
};

export const GUARANTEED_POOL_RULES: GuaranteedRule[] = [
  {
    id: "switch",
    label: "스위치 토글",
    matches: (category, attrs) => category === "block" && !!(attrs as AttrsByCategory["block"]).togglesSwitch,
  },
];
