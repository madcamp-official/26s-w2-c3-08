// 공통 인터랙션 규칙(screen-design.md "인터랙션 공통 규칙")을 구현한 손그림 버튼.
// 1) 기본: 영역 꽉 채운 각진(radius 0) 노랑 + 잉크 테두리, 지글 없음.
// 2) 호버: 안쪽으로 살짝 축소(여백) → 테두리가 둥글어지고 흰색 낙서 테두리가 지글지글.
// 3) 클릭: whileTap로 짧게 세로로 늘어남 → onClick(보통 커튼 트리거)로 전환.
import { forwardRef, useState } from "react";
import { motion } from "framer-motion";
import type { CSSProperties, ReactNode, MouseEventHandler } from "react";
import { YELLOW, INK, SPRING_POP } from "../tokens/index.js";
import { SketchBox } from "./SketchBox.js";

export interface SketchButtonProps {
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLElement>;
  /** 채움색(기본 주역 노랑). */
  fill?: string;
  /** 텍스트 색(기본 잉크). */
  color?: string;
  disabled?: boolean;
  /** 호버 시 둥글어지는 정도. */
  radius?: number;
  style?: CSSProperties;
  className?: string;
}

/** 호버 시 안쪽 여백(축소) 크기(px). */
const HOVER_INSET = 6;

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
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      whileTap={disabled ? undefined : { scaleY: 1.06, scaleX: 0.99 }}
      transition={SPRING_POP}
      style={{
        position: "relative",
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        width: "100%",
        height: "100%",
        ...style,
      }}
    >
      {/* 채움 + 잉크 테두리. 호버 시 안쪽 축소(inset)로 여백을 만들고 radius를 준다. */}
      <motion.span
        animate={{ inset: active ? HOVER_INSET : 0 }}
        transition={SPRING_POP}
        style={{ position: "absolute", inset: 0, display: "block" }}
      >
        <SketchBox
          fill={fill}
          stroke={INK}
          radius={active ? radius : 0}
          preset="frame"
          style={{ width: "100%", height: "100%" }}
        >
          <span style={{ color, fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 18 }}>
            {children}
          </span>
        </SketchBox>
      </motion.span>

      {/* 흰색 낙서 테두리 — 호버 중에만, 지글지글. */}
      {active && (
        <span style={{ position: "absolute", inset: HOVER_INSET - 2, pointerEvents: "none" }}>
          <SketchBox
            stroke="#FFFDF5"
            fill={undefined}
            radius={radius}
            jiggle
            preset="chip"
            style={{ width: "100%", height: "100%" }}
          />
        </span>
      )}
    </motion.button>
  );
});
