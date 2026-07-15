// 맵 에디터 UI 상태 — 패널 크기/접힘은 localStorage 저장(기기별, 2026-07-10 확정 규칙과 동일 원칙).
// 필터·즐겨찾기·선택·닫힘 상태는 세션 한정(라운드마다 새로 배정될 데이터라 영속 불필요).
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlaceholderCard, CardGroup } from "./testData.js";
import { LEFT_PANEL_MAX, LEFT_PANEL_MIN } from "./sizeTokens.js";

interface EditorState {
  // 좌측 창고 패널
  leftPanelWidth: number;
  leftPanelCollapsed: boolean;
  setLeftPanelWidth: (w: number) => void;
  toggleLeftPanelCollapsed: () => void;

  // 상단 즐겨찾기 패널 — 리사이즈 없음, 접기(1줄)만
  favoritesCollapsed: boolean;
  toggleFavoritesCollapsed: () => void;

  // 좌측 창고 필터 (별도 축 — 토글 + 탭)
  ownerFilter: "mine" | "others";
  categoryFilter: "all" | CardGroup;
  setOwnerFilter: (v: "mine" | "others") => void;
  setCategoryFilter: (v: "all" | CardGroup) => void;

  // 즐겨찾기(실사용 슬롯 — 실제 선택 가능한 붓)
  favorites: PlaceholderCard[];
  selectedFavoriteId: string | null;
  addFavorite: (card: PlaceholderCard) => void;
  removeFavorite: (id: string) => void;
  reorderGroup: (group: CardGroup, next: PlaceholderCard[]) => void;
  selectFavorite: (id: string) => void;

  // 우측 툴바(placeholder — 배타적 단일 선택 메커니즘 검증용)
  selectedTool: string | null;
  selectTool: (id: string) => void;

  // 닫기 연출(방향별 스프링 퇴장) 트리거 — mount.tsx의 콘솔 토글이 외부에서 setState로 제어
  closing: boolean;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      leftPanelWidth: 300,
      leftPanelCollapsed: false,
      setLeftPanelWidth: (w) => set({ leftPanelWidth: Math.min(LEFT_PANEL_MAX, Math.max(LEFT_PANEL_MIN, w)) }),
      toggleLeftPanelCollapsed: () => set((s) => ({ leftPanelCollapsed: !s.leftPanelCollapsed })),

      favoritesCollapsed: false,
      toggleFavoritesCollapsed: () => set((s) => ({ favoritesCollapsed: !s.favoritesCollapsed })),

      ownerFilter: "mine",
      categoryFilter: "all",
      setOwnerFilter: (v) => set({ ownerFilter: v }),
      setCategoryFilter: (v) => set({ categoryFilter: v }),

      favorites: [],
      selectedFavoriteId: null,
      addFavorite: (card) =>
        set((s) => (s.favorites.some((f) => f.id === card.id) ? s : { favorites: [...s.favorites, card] })),
      removeFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.filter((f) => f.id !== id),
          selectedFavoriteId: s.selectedFavoriteId === id ? null : s.selectedFavoriteId,
        })),
      // 그룹 하나의 순서만 교체 — 전체 배열에서 그 그룹 카드만 새 순서로 치환(다른 그룹은 그대로)
      reorderGroup: (group, next) =>
        set((s) => ({ favorites: [...s.favorites.filter((f) => f.group !== group), ...next] })),
      selectFavorite: (id) => set({ selectedFavoriteId: id }),

      selectedTool: null,
      selectTool: (id) => set({ selectedTool: id }),

      closing: false,
    }),
    {
      name: "mapeditor-panel-prefs",
      partialize: (s) => ({
        leftPanelWidth: s.leftPanelWidth,
        leftPanelCollapsed: s.leftPanelCollapsed,
        favoritesCollapsed: s.favoritesCollapsed,
      }),
    },
  ),
);
