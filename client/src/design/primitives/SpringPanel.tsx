// 화면 내 팝업(설정 모달·상세 팝업 등). 커튼과 달리 전체화면을 덮지 않고 배경 딤 + 띠용 등장.
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { COLORS, SIZE, SPRING_POP } from "../tokens/index.js";

export interface SpringPanelProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function SpringPanel({ open, onClose, children, title }: SpringPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={SPRING_POP}
            style={{
              background: "#1c2430", borderRadius: SIZE.radius, padding: 28,
              width: SIZE.panelWidth, maxWidth: "90vw", color: "#fff",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            {title && (
              <h2 className="dsPointFont" style={{ margin: "0 0 20px", fontSize: 22, color: COLORS.buildYellow }}>
                {title}
              </h2>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
