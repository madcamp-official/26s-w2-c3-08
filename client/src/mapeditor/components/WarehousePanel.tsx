// 좌측 에셋 창고 — 조회 전용(선택 불가). "+ 즐겨찾기"로 실사용 슬롯에 꺼내야 선택 가능.
// 검색 없음(2026-07-16 확정: 오너토글+카테고리 필터만). 화면 좌측 전체 세로를 차지.
// 왼쪽 화면 밖에서 스프링으로 들어옴/나감. 손그림 SketchBox 재도장.
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { GROUPS, GROUP_LABEL, fetchWarehouseCards, type CardGroup, type PlaceholderCard } from "../testData.js";
import { useEditorStore } from "../editorStore.js";
import { LEFT_PANEL_COLLAPSED_WIDTH, GAP, PAD, FONT_SM, FONT_MD, FAV_CARD_SIZE } from "../sizeTokens.js";
import { edgeTransition, fromLeft } from "../motionTokens.js";
import { CategoryCard } from "./CategoryCard.js";
import { SketchBox } from "../../design/sketch/index.js";
import { YELLOW, INK } from "../../design/tokens/index.js";

export function WarehousePanel({ index, closing }: { index: number; closing: boolean }) {
  const width = useEditorStore((s) => s.leftPanelWidth);
  const collapsed = useEditorStore((s) => s.leftPanelCollapsed);
  const toggleCollapsed = useEditorStore((s) => s.toggleLeftPanelCollapsed);
  const setWidth = useEditorStore((s) => s.setLeftPanelWidth);
  const ownerFilter = useEditorStore((s) => s.ownerFilter);
  const setOwnerFilter = useEditorStore((s) => s.setOwnerFilter);
  const categoryFilter = useEditorStore((s) => s.categoryFilter);
  const setCategoryFilter = useEditorStore((s) => s.setCategoryFilter);
  const favorites = useEditorStore((s) => s.favorites);
  const addFavorite = useEditorStore((s) => s.addFavorite);

  const dragStart = useRef<{ startX: number; startWidth: number } | null>(null);
  const [allCards, setAllCards] = useState<PlaceholderCard[] | null>(null); // null=로딩 중

  useEffect(() => {
    let alive = true;
    void fetchWarehouseCards().then((cards) => { if (alive) setAllCards(cards); });
    return () => { alive = false; };
  }, []);

  function onResizeStart(e: React.PointerEvent) {
    e.preventDefault();
    dragStart.current = { startX: e.clientX, startWidth: width };
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", onResizeEnd);
  }
  function onResizeMove(e: PointerEvent) {
    if (!dragStart.current) return;
    setWidth(dragStart.current.startWidth + (e.clientX - dragStart.current.startX));
  }
  function onResizeEnd() {
    dragStart.current = null;
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup", onResizeEnd);
  }

  const currentWidth = collapsed ? LEFT_PANEL_COLLAPSED_WIDTH : width;
  const favoriteIds = new Set(favorites.map((f) => f.id));
  const cards = (allCards ?? []).filter((c) => {
    const ownerOk = ownerFilter === "mine" ? c.mine : !c.mine;
    const catOk = categoryFilter === "all" || c.group === categoryFilter;
    return ownerOk && catOk;
  });

  return (
    <motion.div
      variants={fromLeft}
      initial="hidden"
      animate={{ ...(closing ? fromLeft.hidden : fromLeft.visible), width: currentWidth }}
      transition={edgeTransition(index, closing)}
      style={{ flexShrink: 0, height: "100%", position: "relative", overflow: "hidden" }}
    >
      <SketchBox fill={YELLOW.list} stroke={INK} preset="panel" center={false}
        contentStyle={{ display: "flex", flexDirection: "column", height: "100%" }}
        style={{ width: "100%", height: "100%" }}
      >
        {collapsed ? null : (
          <div style={{ padding: PAD, overflowY: "auto", overflowX: "hidden", flex: 1, minWidth: 0 }}>
            <h3 className="dsPointFont" style={{ margin: `0 0 ${GAP}px`, fontSize: FONT_LG_LOCAL, fontWeight: 700, color: INK }}>
              에셋 창고
            </h3>

            {/* 별도 축 1: 내가만든/남이만든 (2단 토글) */}
            <div style={{ display: "flex", gap: GAP / 2, marginBottom: GAP }}>
              {(["mine", "others"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setOwnerFilter(v)}
                  style={{ ...segBtnStyle, flex: 1, ...(ownerFilter === v ? segBtnActive : {}) }}
                >
                  {v === "mine" ? "내가만든" : "남이만든"}
                </button>
              ))}
            </div>

            {/* 별도 축 2: 카테고리 탭 (단일선택) */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: GAP / 2, marginBottom: GAP }}>
              {(["all", ...GROUPS] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setCategoryFilter(g)}
                  style={{ ...tabBtnStyle, ...(categoryFilter === g ? tabBtnActive : {}) }}
                >
                  {g === "all" ? "전체" : GROUP_LABEL[g as CardGroup]}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: GAP }}>
              {allCards === null && <div style={{ opacity: 0.6, fontSize: FONT_SM, color: INK }}>불러오는 중…</div>}
              {allCards !== null && cards.length === 0 && <div style={{ opacity: 0.6, fontSize: FONT_SM, color: INK }}>해당 조건의 에셋 없음</div>}
              {cards.map((c) => (
                <CategoryCard
                  key={c.id}
                  card={c}
                  size={FAV_CARD_SIZE}
                  actionIcon="+"
                  actionTitle={favoriteIds.has(c.id) ? "이미 즐겨찾기에 있음" : "즐겨찾기에 추가"}
                  actionDisabled={favoriteIds.has(c.id)}
                  onAction={() => addFavorite(c)}
                  style={{ cursor: "default" }}
                />
              ))}
            </div>
          </div>
        )}
      </SketchBox>

      {/* 안쪽 테두리 리사이즈 핸들 + 접기 버튼(중앙) — SketchBox 밖, motion.div 기준 절대배치 */}
      {!collapsed && (
        <div
          onPointerDown={onResizeStart}
          style={{ position: "absolute", top: 0, right: -4, width: 8, height: "100%", cursor: "col-resize", zIndex: 2 }}
        />
      )}
      <button
        onClick={toggleCollapsed}
        style={{
          ...arrowBtnStyle,
          position: "absolute",
          top: "50%",
          ...(collapsed ? { left: "50%", transform: "translate(-50%, -50%)" } : { right: -16, transform: "translateY(-50%)" }),
        }}
        title={collapsed ? "에셋 창고 펼치기" : "에셋 창고 접기"}
      >
        {collapsed ? "▶" : "◀"}
      </button>
    </motion.div>
  );
}

const FONT_LG_LOCAL = FONT_MD + 2;

const arrowBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  background: YELLOW.card,
  color: INK,
  border: `2px solid ${INK}`,
  borderRadius: 10,
  cursor: "pointer",
  fontSize: FONT_SM,
  lineHeight: 1,
};

const BTN_PAD_V_LOCAL = 10;
const segBtnStyle: React.CSSProperties = {
  background: YELLOW.card,
  color: INK,
  border: `2px solid ${INK}`,
  borderRadius: 10,
  padding: `${BTN_PAD_V_LOCAL}px 0`,
  fontSize: FONT_MD,
  cursor: "pointer",
  fontFamily: "var(--font-body)",
};
const segBtnActive: React.CSSProperties = { background: YELLOW.base };

const tabBtnStyle: React.CSSProperties = {
  background: YELLOW.card,
  color: INK,
  border: `2px solid ${INK}`,
  borderRadius: 10,
  padding: "6px 14px",
  fontSize: FONT_SM,
  cursor: "pointer",
  fontFamily: "var(--font-body)",
};
const tabBtnActive: React.CSSProperties = { background: YELLOW.base };
