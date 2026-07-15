// 색 변환·거리 유틸. 크로마키 키색 선택(HSV 거리)에 쓰임.
// Rgb/rgbDistanceNorm은 shared/imaging으로 이동(서버와 공유) — 여기서 재export해 기존 import 유지.
import type { Rgb } from "shared/imaging";
export { rgbDistanceNorm, type Rgb } from "shared/imaging";
export interface Hsv {
  /** 0~360 */
  h: number;
  /** 0~1 */
  s: number;
  /** 0~1 */
  v: number;
}

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/** HSV 원뿔 좌표계 거리 — 색상 순환성과 저채도 상황을 함께 다룸. 상대 순위용(정확한 0~1 정규화 아님) */
export function hsvDistance(a: Hsv, b: Hsv): number {
  const va = hsvCone(a);
  const vb = hsvCone(b);
  return Math.hypot(va[0] - vb[0], va[1] - vb[1], va[2] - vb[2]);
}

function hsvCone(c: Hsv): [number, number, number] {
  const rad = (c.h * Math.PI) / 180;
  return [c.s * c.v * Math.cos(rad), c.s * c.v * Math.sin(rad), c.v];
}

