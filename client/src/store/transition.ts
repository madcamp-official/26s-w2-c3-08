// 커튼(화면 전환) 활성 상태 — MorphCurtain이 구독, useMorphTransition이 조작.
// originRect: 트리거 요소의 시작 위치/크기(px, viewport 기준) — 그 요소가 화면을 덮는 것처럼 보이도록.
import { create } from "zustand";

export interface OriginRect { x: number; y: number; width: number; height: number; borderRadius: number }

interface TransitionStore {
  active: boolean;
  originRect: OriginRect | null;
  originColor: string;
  setActive: (active: boolean, originRect?: OriginRect | null, originColor?: string) => void;
}

export const useTransitionStore = create<TransitionStore>((set) => ({
  active: false,
  originRect: null,
  originColor: "#F6BE00",
  setActive: (active, originRect, originColor) =>
    set({ active, ...(originRect !== undefined ? { originRect } : {}), ...(originColor ? { originColor } : {}) }),
}));
