// 지글지글 = seed를 주기적으로 교체해 손그림 테두리가 계속 다시 그려지며 흔들리는 효과.
// 기존 확정 규칙: 상시 아님 — 호버/선택(active) 중에만 흔들린다. 비활성 시 기준 seed 고정.
import { useEffect, useRef, useState } from "react";
import { newSeed } from "./rough.js";

/** 지글 프레임 간격(ms) — screen-design.md 확정값. */
export const JIGGLE_INTERVAL_MS = 120;

/**
 * active가 true인 동안 JIGGLE_INTERVAL_MS마다 새 seed를 뱉는다.
 * active=false면 마운트 시 한 번 뽑은 안정 seed를 계속 유지(부속품 고유 모양).
 */
export function useJiggle(active: boolean): number {
  const baseSeed = useRef(newSeed());
  const [seed, setSeed] = useState(baseSeed.current);

  useEffect(() => {
    if (!active) {
      setSeed(baseSeed.current);
      return;
    }
    const timer = setInterval(() => setSeed(newSeed()), JIGGLE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active]);

  return seed;
}
