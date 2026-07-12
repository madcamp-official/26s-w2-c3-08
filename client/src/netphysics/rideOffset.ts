// "접촉 대상의 그려지는 표면 추종" (§17-2). 밟힘 스쿼시 위에 선 사람의 렌더 y 보정.
import type { SquashState } from "./squash.js";

/** 대상(고스트)의 스쿼시로 줄어든 시각적 머리 y 를 계산 */
export function visualTopOf(ghostY: number, ghostH: number, sq: SquashState | null): number {
  const h = ghostH * (sq ? sq.sy : 1);
  return ghostY - h;
}
