// 우측 세로 툴바 — 실제 도구 구성은 미확정. placeholder 도구로 "배타적 단일 선택" 메커니즘만 검증.
// 감싸는 테두리·배경 없음 — 정사각형 버튼만 공중에 떠 있고, 남는 세로 공간 안에서 가운데 정렬(2026-07-15).
// 고정폭, 리사이즈·접기 없음. 오른쪽 화면 밖에서 스프링으로 들어옴/나감.
import { motion } from "framer-motion";
import { useEditorStore } from "../editorStore.js";
import { BORDER_W, FONT_SM, GAP, RADIUS, TOOLBAR_WIDTH } from "../sizeTokens.js";
import { edgeTransition, fromRight } from "../motionTokens.js";

const TOOL_SIZE = 64;

const PLACEHOLDER_TOOLS = [
  { id: "select", label: "선택" },
  { id: "erase", label: "지우개" },
  { id: "move", label: "이동" },
];

export function Toolbar({ index, closing }: { index: number; closing: boolean }) {
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const selectTool = useEditorStore((s) => s.selectTool);

  return (
    <motion.div
      variants={fromRight}
      initial="hidden"
      animate={closing ? "hidden" : "visible"}
      transition={edgeTransition(index, closing)}
      style={{
        width: TOOLBAR_WIDTH,
        flexShrink: 0,
        height: "100%",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: GAP,
      }}
    >
      {PLACEHOLDER_TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => selectTool(tool.id)}
          style={{
            width: TOOL_SIZE,
            height: TOOL_SIZE,
            fontSize: FONT_SM,
            background: selectedTool === tool.id ? "#fff" : "#000",
            color: selectedTool === tool.id ? "#000" : "#fff",
            border: `${BORDER_W}px solid #fff`,
            borderRadius: RADIUS,
            cursor: "pointer",
          }}
        >
          {tool.label}
        </button>
      ))}
    </motion.div>
  );
}
