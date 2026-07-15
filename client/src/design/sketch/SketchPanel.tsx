// 손그림 팝업 — 딤 배경 + 띠용 등장 + 항상 지글거리는 낙서 테두리(팝업 공통 규칙).
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { YELLOW, INK, SPRING_POP } from "../tokens/index.js";
import { SketchBox } from "./SketchBox.js";

export interface SketchPanelProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  width?: number;
}

export function SketchPanel({ open, onClose, children, title, width = 420 }: SketchPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, background: "rgba(59,47,20,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={SPRING_POP}
            style={{ width, maxWidth: "90vw" }}
          >
            <SketchBox fill={YELLOW.list} stroke={INK} radius={18} jiggle preset="panel"
              center={false} contentStyle={{ padding: 28, boxSizing: "border-box" }}>
              {title && (
                <h2 className="dsPointFont" style={{ margin: "0 0 20px", fontSize: 22, color: INK }}>
                  {title}
                </h2>
              )}
              {children}
            </SketchBox>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
