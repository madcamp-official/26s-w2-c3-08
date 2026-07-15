// 화면 전환 커튼 — 트리거 요소의 실제 위치(originRect)에서 전체화면으로 스프링 확장→로딩 표시→
// 우측 이탈(공용 규칙)하며 다음 화면을 드러낸다. 실제 화면 교체는 덮인 상태에서 일어난다.
// 앱 루트(AppShell)에 딱 1개만 마운트 — layoutId 공유 없이 rect를 직접 보간(예측 가능성 우선).
import { AnimatePresence, motion } from "framer-motion";
import { useTransitionStore } from "../../store/transition.js";
import { SPRING_POP } from "../tokens/index.js";
import { TileTexture } from "../primitives/TileTexture.js";

export function MorphCurtain() {
  const active = useTransitionStore((s) => s.active);
  const originRect = useTransitionStore((s) => s.originRect);
  const originColor = useTransitionStore((s) => s.originColor);

  const from = originRect ?? { x: window.innerWidth / 2, y: window.innerHeight / 2, width: 0, height: 0, borderRadius: 999 };

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ left: from.x, top: from.y, width: from.width, height: from.height, borderRadius: from.borderRadius }}
          animate={{ left: 0, top: 0, width: "100vw", height: "100vh", borderRadius: 0 }}
          exit={{ left: "100vw", width: "100vw", height: "100vh", borderRadius: 0 }}
          transition={SPRING_POP}
          style={{
            position: "fixed", background: originColor, zIndex: 1000, overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <TileTexture />
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ ...SPRING_POP, delay: 0.15 }}
            className="dsPointFont"
            style={{ fontSize: 28, color: "#1a1a1a" }}
          >
            로딩중입니다
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
