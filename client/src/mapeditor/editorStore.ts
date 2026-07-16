// 맵 에디터 UI 상태 — 패널 크기/접힘은 localStorage 저장(기기별, 2026-07-10 확정 규칙과 동일 원칙).
// 필터·즐겨찾기·선택·닫힘 상태는 세션 한정(라운드마다 새로 배정될 데이터라 영속 불필요).
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlaceholderCard, CardGroup } from "./testData.js";
import { LEFT_PANEL_MAX, LEFT_PANEL_MIN } from "./sizeTokens.js";
import {
  type PlacedItem, type PlaceCategory,
  anchorToTopLeft, occupiedTiles, canPlace, itemAt,
} from "./engine/placement.js";
import { type FlagPos, bothFlagsForbidden, canMoveFlag } from "./engine/flags.js";
import { GRID_H } from "./engine/grid.js";

/** 로컬 배치 uid 발급 */
let placeUid = 0;
const nextPlaceId = (): string => `pi${++placeUid}`;

/** 기본 깃발 위치 — 바닥(기단 y+1이 마지막 행) 근처, 최소거리 충족 */
const DEFAULT_START: FlagPos = { x: 2, y: GRID_H - 2 };  // (2, 10) → 기단 y=11
const DEFAULT_END: FlagPos = { x: 22, y: GRID_H - 2 };   // (22, 10)

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

  // ── 배치 상태(P1) — 영속 안 함(라운드마다 새 라인) ──
  placements: Record<string, PlacedItem>;
  startFlag: FlagPos;
  endFlag: FlagPos;
  /** 현재 붓 = 선택된 즐겨찾기 카드. 좌클릭 배치의 대상. */
  brush: () => PlaceholderCard | null;
  /** 좌하단 앵커 타일에 현재 붓으로 배치 시도. 성공 시 true(호출부 사운드용) */
  placeAtAnchor: (anchorX: number, anchorY: number) => boolean;
  /** 타일 (tx,ty)를 덮는 배치물 삭제. 성공 시 true */
  eraseAt: (tx: number, ty: number) => boolean;
  /** 타일 (tx,ty)를 덮는 배치물 좌우반전 토글(더블클릭). 성공 시 true */
  flipAt: (tx: number, ty: number) => boolean;
  /** 깃발 이동(규칙 위반이면 무시). 성공 시 true */
  moveFlag: (which: "start" | "end", nx: number, ny: number) => boolean;
  /** 드래그로 "들려 있는" 깃발 — 렌더러가 흔들흔들+그림자 연출(스펙: 꾹 누르면 들림 표시) */
  liftedFlag: "start" | "end" | null;
  setLiftedFlag: (which: "start" | "end" | null) => void;

  // 닫기 연출(방향별 스프링 퇴장) 트리거 — mount.tsx의 콘솔 토글이 외부에서 setState로 제어
  closing: boolean;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      leftPanelWidth: 300,
      leftPanelCollapsed: false,
      setLeftPanelWidth: (w) => set({ leftPanelWidth: Math.min(LEFT_PANEL_MAX, Math.max(LEFT_PANEL_MIN, w)) }),
      toggleLeftPanelCollapsed: () => set((s) => ({ leftPanelCollapsed: !s.leftPanelCollapsed })),

      favoritesCollapsed: false,
      toggleFavoritesCollapsed: () => set((s) => ({ favoritesCollapsed: !s.favoritesCollapsed })),

      // 기본값 "others" — 지금 DB의 76개 테스트 에셋이 전부 isSystem(공용)이라 "mine"이 기본이면 창고가 비어 보임
      ownerFilter: "others",
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
      // 단일 선택 + 재클릭 시 해제(스펙: 붓 끄기) — 선택 카드는 지글 테두리 유지(P4 연출)
      selectFavorite: (id) => set((s) => ({ selectedFavoriteId: s.selectedFavoriteId === id ? null : id })),

      // ── 배치 상태(P1) ──
      placements: {},
      startFlag: DEFAULT_START,
      endFlag: DEFAULT_END,

      brush: () => {
        const s = get();
        return s.favorites.find((f) => f.id === s.selectedFavoriteId) ?? null;
      },

      placeAtAnchor: (anchorX, anchorY) => {
        const s = get();
        const card = s.brush();
        // block/monster/item만 타일 배치(배경은 라인단위 별도 방식 → §placeBackground 대상)
        if (!card || card.category === "background" || card.category === "avatar") return false;
        const { x, y } = anchorToTopLeft(anchorX, anchorY, card.h);
        const items = Object.values(s.placements);
        const occupied = occupiedTiles(items);
        const forbidden = bothFlagsForbidden(s.startFlag, s.endFlag);
        if (!canPlace(x, y, card.w, card.h, occupied, forbidden)) return false;
        const id = nextPlaceId();
        const item: PlacedItem = {
          id, assetKey: card.id, category: card.category as PlaceCategory,
          w: card.w, h: card.h, x, y, flipX: false, sourceImageUrl: card.sourceImageUrl,
        };
        set({ placements: { ...s.placements, [id]: item } });
        return true;
      },

      eraseAt: (tx, ty) => {
        const s = get();
        const hit = itemAt(Object.values(s.placements), tx, ty);
        if (!hit) return false;
        const next = { ...s.placements };
        delete next[hit];
        set({ placements: next });
        return true;
      },

      flipAt: (tx, ty) => {
        const s = get();
        const hit = itemAt(Object.values(s.placements), tx, ty);
        if (!hit) return false;
        const it = s.placements[hit];
        set({ placements: { ...s.placements, [hit]: { ...it, flipX: !it.flipX } } });
        return true;
      },

      moveFlag: (which, nx, ny) => {
        const s = get();
        const other = which === "start" ? s.endFlag : s.startFlag;
        if (!canMoveFlag(which, nx, ny, other)) return false;
        set(which === "start" ? { startFlag: { x: nx, y: ny } } : { endFlag: { x: nx, y: ny } });
        return true;
      },

      liftedFlag: null,
      setLiftedFlag: (which) => set({ liftedFlag: which }),

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
