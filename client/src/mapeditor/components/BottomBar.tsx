// 우하단 바 — 시간추가/단축 · 남은시간 · [테스트하기]. 전부 정적 placeholder(로직 없음).
// 우측 영역 안에서만 존재. 아래쪽 화면 밖에서 스프링으로 들어옴/나감.
import { motion } from "framer-motion";
import { BORDER_W, FONT_MD, GAP, PAD, RADIUS_SM } from "../sizeTokens.js";
import { edgeTransition, fromBottom } from "../motionTokens.js";

export function BottomBar({ index, closing }: { index: number; closing: boolean }) {
  return (
    <motion.div
      variants={fromBottom}
      initial="hidden"
      animate={closing ? "hidden" : "visible"}
      transition={edgeTransition(index, closing)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: GAP,
        padding: `${GAP}px ${PAD}px`,
        borderTop: `${BORDER_W}px solid #fff`,
        color: "#fff",
        background: "#000",
      }}
    >
      <button style={btnStyle}>시간 단축</button>
      <button style={btnStyle}>시간 추가</button>
      <span style={{ marginLeft: GAP / 2, fontSize: FONT_MD }}>남은시간 03:00</span>
      <button style={{ ...btnStyle, marginLeft: "auto", padding: "12px 28px" }}>테스트하기</button>
    </motion.div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#000",
  color: "#fff",
  border: `${BORDER_W}px solid #fff`,
  borderRadius: RADIUS_SM,
  padding: "10px 18px",
  fontSize: FONT_MD,
  cursor: "pointer",
};
