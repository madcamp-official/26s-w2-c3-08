// 공용 버튼 — hover/click 스프링 피드백. ref를 넘기면 커튼 트리거 원점(rect)으로도 쓰인다.
import { motion } from "framer-motion";
import { forwardRef } from "react";
import type { ReactNode, MouseEventHandler, CSSProperties } from "react";
import { COLORS, SIZE, SPRING_POP, HOVER_SCALE, CLICK_SCALE } from "../tokens/index.js";

type Variant = "primary" | "danger" | "ghost";

const VARIANT_BG: Record<Variant, string> = {
  primary: COLORS.buildYellow,
  danger: COLORS.marioRed,
  ghost: "rgba(255,255,255,0.08)",
};

export interface SpringButtonProps {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: Variant;
  disabled?: boolean;
  style?: CSSProperties;
}

export const SpringButton = forwardRef<HTMLButtonElement, SpringButtonProps>(
  ({ children, onClick, variant = "primary", disabled, style }, ref) => (
    <motion.button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: HOVER_SCALE }}
      whileTap={disabled ? undefined : { scale: CLICK_SCALE }}
      transition={SPRING_POP}
      style={{
        background: VARIANT_BG[variant],
        color: variant === "ghost" ? "#fff" : "#1a1a1a",
        border: "none",
        borderRadius: SIZE.radius,
        padding: "12px 28px",
        fontFamily: "var(--font-body)",
        fontWeight: 700,
        fontSize: 16,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </motion.button>
  ),
);
SpringButton.displayName = "SpringButton";
