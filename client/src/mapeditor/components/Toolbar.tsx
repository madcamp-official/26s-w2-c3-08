// 우측 세로 패널 — 도구 버튼은 삭제(2026-07-16 확정), 조작법 상시 안내 + 장전된 에셋 이름 표시로 교체 예정(P1은 손그림 셸만).
// 고정폭, 리사이즈·접기 없음. 오른쪽 화면 밖에서 스프링으로 들어옴/나감.
import { motion } from "framer-motion";
import { useEditorStore } from "../editorStore.js";
import { GAP, TOOLBAR_WIDTH } from "../sizeTokens.js";
import { edgeTransition, fromRight } from "../motionTokens.js";
import { SketchBox } from "../../design/sketch/index.js";
import { YELLOW, INK, INK_SOFT } from "../../design/tokens/index.js";

const GUIDE_LINES = [
  { icon: "🖱️L", text: "배치 / 선택 / 경로드래그" },
  { icon: "🖱️R", text: "삭제" },
  { icon: "L+R", text: "화면 이동(팬)" },
  { icon: "휠", text: "확대·축소" },
  { icon: "더블클릭", text: "좌우반전" },
];

export function Toolbar({ index, closing }: { index: number; closing: boolean }) {
  const favorites = useEditorStore((s) => s.favorites);
  const selectedFavoriteId = useEditorStore((s) => s.selectedFavoriteId);
  const loaded = favorites.find((f) => f.id === selectedFavoriteId);

  return (
    <motion.div
      variants={fromRight}
      initial="hidden"
      animate={closing ? "hidden" : "visible"}
      transition={edgeTransition(index, closing)}
      style={{ width: TOOLBAR_WIDTH + 60, flexShrink: 0, height: "100%", padding: GAP / 2 }}
    >
      <SketchBox fill={YELLOW.list} stroke={INK} preset="panel" center={false}
        contentStyle={{ display: "flex", flexDirection: "column", gap: GAP, padding: GAP, boxSizing: "border-box", height: "100%" }}
        style={{ width: "100%", height: "100%" }}
      >
        <div style={{ fontSize: 11, color: INK_SOFT }}>조작법</div>
        {GUIDE_LINES.map((g) => (
          <div key={g.text} style={{ fontSize: 11, color: INK, lineHeight: 1.4 }}>
            <div style={{ fontWeight: 700 }}>{g.icon}</div>
            <div>{g.text}</div>
          </div>
        ))}
        <div style={{ marginTop: "auto", borderTop: `1.5px solid ${INK_SOFT}`, opacity: 0.9, paddingTop: GAP, fontSize: 11 }}>
          <div style={{ color: INK_SOFT, marginBottom: 4 }}>장전됨</div>
          <div style={{ color: INK, fontWeight: 700 }}>{loaded ? loaded.label : "없음"}</div>
        </div>
      </SketchBox>
    </motion.div>
  );
}
