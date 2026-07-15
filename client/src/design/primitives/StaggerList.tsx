// 자식 요소 순차(스태거) 등장 래퍼.
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { STAGGER_MS, SPRING_POP } from "../tokens/index.js";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: STAGGER_MS } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: SPRING_POP },
};

export function StaggerList({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <motion.div variants={container} initial="hidden" animate="show" style={style}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <motion.div variants={item} style={style}>
      {children}
    </motion.div>
  );
}
