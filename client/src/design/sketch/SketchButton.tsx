// 공통 인터랙션 규칙(screen-design.md "인터랙션 공통 규칙") 구현 손그림 버튼.
// 1) 기본: 영역 꽉 채운(각진, radius 0) 노랑 + 잉크 손그림 테두리.
// 2) 호버: 전체가 살짝 축소(scale, 여백 발생) → 테두리 둥글어지고 흰색 낙서 테두리가 지글지글.
// 3) 클릭: whileTap로 짧게 세로로 늘어남 → onClick(보통 커튼 트리거).
// 구조는 SketchBox를 "직접 자식"으로 둔다(절대배치 래퍼가 크기측정을 깨뜨렸던 버그 회피).
import { forwardRef, useState } from "react";
import { motion } from "framer-motion";
import type { CSSProperties, ReactNode, MouseEventHandler } from "react";
import { YELLOW, INK, SPRING_POP } from "../tokens/index.js";
import { SketchBox } from "./SketchBox.js";

export interface SketchButtonProps {
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  fill?: string;
  color?: string;
  disabled?: boolean;
  radius?: number;
  style?: CSSProperties;
  className?: string;
}

export const SketchButton = forwardRef<HTMLButtonElement, SketchButtonProps>(function SketchButton(
  { children, onClick, fill = YELLOW.base, color = INK, disabled, radius = 14, style, className },
  ref,
) {
  const [hover, setHover] = useState(false);
  const active = hover && !disabled;

  return (
    <motion.button
      ref={ref}
      className={className}
      disabled={disabled}
      onClick={onClick}
      // 커튼이 배경색을 읽을 수 있게(버튼 bg는 transparent라 CSS로는 못 읽음).
      data-morph-color={fill}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      animate={{ scale: active ? 0.955 : 1 }}
      whileTap={disabled ? undefined : { scaleY: 1.06, scaleX: 0.985 }}
      transition={SPRING_POP}
      style={{
        position: "relative",
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        width: "100%",
        height: "100%",
        ...style,
      }}
    >
      {/* 채움 + 잉크 테두리 — SketchBox 직접 자식(측정 정상). 호버 시 radius로 둥글어짐. */}
      <SketchBox fill={fill} stroke={INK} radius={active ? radius : 0} preset="frame"
        style={{ width: "100%", height: "100%" }}>
        <span style={{ color, fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 18 }}>
          {children}
        </span>
      </SketchBox>

      {/* 흰색 낙서 테두리 — 호버 중에만, 항상 지글. 버튼 안쪽에 겹쳐 그림. */}
      {active && (
        <span style={{ position: "absolute", inset: 5, pointerEvents: "none" }}>
          <SketchBox stroke="#FFFDF5" fill={undefined} radius={radius} jiggle preset="chip"
            style={{ width: "100%", height: "100%" }} />
        </span>
      )}
    </motion.button>
  );
});
