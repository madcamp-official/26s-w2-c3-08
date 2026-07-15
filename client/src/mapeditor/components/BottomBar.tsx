// 우하단 바 — [시간단축][시간추가](붙여서) → 남은시간 → 여백 → [테스트하기](우측 22% 세로 꽉, 2026-07-16 확정).
// 시간조정 로직·검증뱃지는 아직 미구현(P1은 손그림 셸 + 레이아웃까지) — §P1 스펙 7·9 항목.
import { motion } from "framer-motion";
import { GAP, PAD } from "../sizeTokens.js";
import { edgeTransition, fromBottom } from "../motionTokens.js";
import { SketchBox, SketchButton } from "../../design/sketch/index.js";
import { YELLOW, INK } from "../../design/tokens/index.js";

const BAR_HEIGHT = 64;

export function BottomBar({ index, closing }: { index: number; closing: boolean }) {
  return (
    <motion.div
      variants={fromBottom}
      initial="hidden"
      animate={closing ? "hidden" : "visible"}
      transition={edgeTransition(index, closing)}
      style={{ padding: `${GAP / 2}px ${PAD}px`, flexShrink: 0 }}
    >
      <SketchBox fill={YELLOW.list} stroke={INK} preset="panel" center={false}
        contentStyle={{ display: "flex", alignItems: "center", gap: 0, padding: `${GAP / 2}px ${GAP}px`, height: BAR_HEIGHT, boxSizing: "border-box" }}
        style={{ width: "100%", height: BAR_HEIGHT + GAP }}
      >
        {/* 시간단축/시간추가 — 붙여서(사이 간격 없음) */}
        <div style={{ display: "flex", height: "70%" }}>
          <div style={{ width: 96 }}><SketchButton fill={YELLOW.card} radius={0}><span style={{ fontSize: 13 }}>시간단축</span></SketchButton></div>
          <div style={{ width: 96 }}><SketchButton fill={YELLOW.card} radius={0}><span style={{ fontSize: 13 }}>시간추가</span></SketchButton></div>
        </div>

        <span className="dsPointFont" style={{ marginLeft: GAP, fontSize: 18, color: INK, fontWeight: 700 }}>03:00</span>

        <div style={{ flex: 1 }} />

        {/* 테스트하기 — 하단바 우측 22% 세로 꽉 채움(일반 버튼 아님, 공통 "꽉 찬 요소" 취급) */}
        <div style={{ width: "22%", height: "100%" }}>
          <SketchButton><span style={{ fontSize: 15 }}>테스트하기</span></SketchButton>
        </div>
      </SketchBox>
    </motion.div>
  );
}
