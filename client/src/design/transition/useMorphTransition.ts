// 커튼 오케스트레이션 훅 — ref를 트리거 요소(버튼 등)에 붙이고 trigger(loadFn)로 실행.
import { useRef } from "react";
import { useTransitionStore, type OriginRect } from "../../store/transition.js";
import { CURTAIN_MIN_DWELL_MS } from "../tokens/index.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function readRect(el: HTMLElement): OriginRect {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return { x: r.x, y: r.y, width: r.width, height: r.height, borderRadius: parseFloat(cs.borderRadius) || 0 };
}

export function useMorphTransition<T extends HTMLElement = HTMLButtonElement>() {
  const ref = useRef<T | null>(null);
  const setActive = useTransitionStore((s) => s.setActive);

  /** originColor 생략 시 트리거 요소의 실제 배경색을 읽어 씀(그 요소가 그대로 커진 것처럼) */
  async function trigger(loadFn: () => Promise<void>, originColor?: string): Promise<void> {
    const el = ref.current;
    const rect = el ? readRect(el) : null;
    const color = originColor ?? (el ? getComputedStyle(el).backgroundColor : "#F6BE00");
    setActive(true, rect, color);
    const start = Date.now();
    try {
      await loadFn();
    } finally {
      const elapsed = Date.now() - start;
      if (elapsed < CURTAIN_MIN_DWELL_MS) await sleep(CURTAIN_MIN_DWELL_MS - elapsed);
      setActive(false);
    }
  }

  return { ref, trigger };
}
