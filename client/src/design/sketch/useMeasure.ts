// 가변 크기 요소(풀블리드 바·방 카드)의 실제 픽셀 크기를 관측 — rough가 그 크기로 테두리 생성.
import { useLayoutEffect, useRef, useState } from "react";

export interface Size { w: number; h: number }

/** 요소 크기를 ResizeObserver로 추적. 크기 바뀌면 리렌더 → 테두리 재생성. */
export function useMeasure<T extends HTMLElement>(): [React.RefObject<T | null>, Size] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}
