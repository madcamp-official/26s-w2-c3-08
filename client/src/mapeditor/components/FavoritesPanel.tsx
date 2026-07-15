// 상단 즐겨찾기 — 이번 판 실사용 슬롯. 여기 있는 카드만 실제 "붓"으로 선택 가능.
// 우측 영역(좌측 창고 제외) 안에서만 존재. 위쪽 화면 밖에서 스프링으로 들어옴/나감.
// 리사이즈 없음 — 접기(1줄)만. 접힘 높이는 카드 한 줄이 잘리지 않는 고정값(FAVORITES_ONE_ROW_HEIGHT).
// 접기 버튼 = 좌측 창고와 같은 방식(가장자리 중앙의 화살표, 접힘에 따라 방향 반전) — 잘리는 안쪽 래퍼 밖에 둬서
// 접힘 상태에서도 항상 온전히 보임(2026-07-15 버그 수정).
// 높이 전환은 framer-motion `layout`(FLIP) 대신 실측 높이(ResizeObserver)로 직접 animate —
// `layout`을 쓰면 좌측 패널 폭 변화(형제 요소 리플로우) 때마다 이 패널의 높이까지 덩달아 흔들리는 버그가 있었음.
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { GROUPS, type CardGroup, type PlaceholderCard } from "../testData.js";
import { useEditorStore } from "../editorStore.js";
import { FAV_CARD_SIZE, FAVORITES_ONE_ROW_HEIGHT, GAP, PAD } from "../sizeTokens.js";
import { edgeTransition, fromTop, springPop } from "../motionTokens.js";
import { FavoriteGroupBox } from "./FavoriteGroupBox.js";
import { SketchBox } from "../../design/sketch/index.js";
import { YELLOW, INK } from "../../design/tokens/index.js";

export function FavoritesPanel({ index, closing }: { index: number; closing: boolean }) {
  const collapsed = useEditorStore((s) => s.favoritesCollapsed);
  const toggleCollapsed = useEditorStore((s) => s.toggleFavoritesCollapsed);
  const favorites = useEditorStore((s) => s.favorites);

  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(FAVORITES_ONE_ROW_HEIGHT);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setContentHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const grouped: Record<CardGroup, PlaceholderCard[]> = { block: [], monster: [], item: [], background: [] };
  for (const f of favorites) grouped[f.group].push(f);
  const activeGroups = GROUPS.filter((g) => grouped[g].length > 0);

  return (
    <motion.div
      variants={fromTop}
      initial="hidden"
      animate={closing ? "hidden" : "visible"}
      transition={edgeTransition(index, closing)}
      style={{ flexShrink: 0, position: "relative" }}
    >
      <SketchBox fill={YELLOW.list} stroke={INK} preset="panel" center={false} style={{ width: "100%" }}>
      {/* 잘림은 이 안쪽 래퍼에서만 — 높이는 실측값으로 직접 스프링 애니메이션(layout FLIP 아님) */}
      <motion.div
        animate={{ height: collapsed ? FAVORITES_ONE_ROW_HEIGHT : contentHeight }}
        transition={springPop}
        style={{ overflow: "hidden" }}
      >
        <div ref={contentRef} style={{ display: "flex", flexWrap: collapsed ? "nowrap" : "wrap", gap: GAP, padding: PAD }}>
          {activeGroups.length === 0 && (
            <div style={{ opacity: 0.6, fontSize: 13, padding: 4, color: INK }}>
              좌측 창고에서 [+ 즐겨찾기]로 에셋을 꺼내오세요.
            </div>
          )}
          {activeGroups.map((g) => (
            <motion.div
              key={g}
              layout
              transition={springPop}
              style={{ flexGrow: grouped[g].length, flexBasis: 0, minWidth: FAV_CARD_SIZE + GAP * 2 }}
            >
              <FavoriteGroupBox group={g} cards={grouped[g]} collapsed={collapsed} />
            </motion.div>
          ))}
        </div>
      </motion.div>
      </SketchBox>

      {/* 접기 버튼 — 좌측 창고와 동일하게 가장자리 중앙(여기선 아래쪽 바깥 경계). SketchBox 밖이라 절대 안 잘림. */}
      <button
        onClick={toggleCollapsed}
        style={{ ...arrowBtnStyle, position: "absolute", bottom: -16, left: "50%", transform: "translateX(-50%)" }}
        title={collapsed ? "즐겨찾기 펼치기" : "즐겨찾기 접기(한 줄로)"}
      >
        {collapsed ? "▼" : "▲"}
      </button>
    </motion.div>
  );
}

const arrowBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  background: YELLOW.card,
  color: INK,
  border: `2px solid ${INK}`,
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  zIndex: 3,
};
