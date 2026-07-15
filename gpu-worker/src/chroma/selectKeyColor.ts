// Stage 2.5 — 크로마키 키색 자동 선택. gpu-worker 로컬에서 계산(서버 불필요).
// 원리: 원본 그림의 불투명 픽셀 색들과 후보색(config)의 HSV 거리를 재서, "그림의 가장 가까운 색과도
// 최대한 먼" 후보를 고른다(min-거리 최대화). 이러면 캐릭터 어느 색과도 안 겹치는 배경색이 뽑혀
// 나중에 크로마키 제거가 캐릭터를 안 갉아먹는다. 검정 외곽선 캐릭터면 검정과 먼 녹/마젠타가 자동 선택.
import type { RgbaFrame } from "../pipeline/types.js";
import { pngToFrame } from "../image/raster.js";
import { hexToRgb, hsvDistance, rgbToHsv, rgbDistanceNorm, type Hsv, type Rgb } from "../image/color.js";
import { pipelineConfig } from "../config/index.js";

export interface KeyColorChoice {
  name: string;
  hex: string;
  /** 그림의 가장 가까운 색과의 HSV 거리(클수록 안전) — 후보 선택 기준 */
  margin: number;
  /**
   * 선택된 키색과 그림 색들 간 최소 "정규화 RGB 거리"(0~1). 크로마키 스테이지의
   * 갇힌-배경 회수(reclaim)가 RGB 거리로 판정하므로, 그 게이트도 같은 단위여야 해서 별도 제공.
   * 크면 캐릭터가 키색과 확실히 멀다 = 회수 안전 / 작으면 회수 off.
   */
  rgbMargin: number;
}

/** 불투명 픽셀을 최대 이 개수까지 표본으로 (성능) */
const MAX_SAMPLES = 4000;

export async function selectKeyColorFromPng(sourcePng: Buffer): Promise<KeyColorChoice> {
  const frame = await pngToFrame(sourcePng);
  return selectKeyColor(frame);
}

export function selectKeyColor(frame: RgbaFrame): KeyColorChoice {
  const drawingColors = sampleOpaqueHsv(frame);
  const candidates = pipelineConfig.chromaKey.candidates;

  let best: { name: string; hex: string; margin: number } | null = null;
  for (const c of candidates) {
    const rgb = hexToRgb(c.hex);
    const chsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    // 이 후보가 그림의 "가장 가까운" 색과 얼마나 떨어져 있나 (작을수록 위험) → 이 최소거리를 최대화
    let minDist = Infinity;
    for (const dc of drawingColors) {
      const d = hsvDistance(chsv, dc);
      if (d < minDist) minDist = d;
    }
    if (best === null || minDist > best.margin) {
      best = { name: c.name, hex: c.hex, margin: minDist === Infinity ? 0 : minDist };
    }
  }
  // 후보가 최소 1개인 것은 zod가 보장 → best는 non-null
  const chosen = best as { name: string; hex: string; margin: number };
  const rgbMargin = minRgbDistToOpaque(frame, hexToRgb(chosen.hex));
  return { ...chosen, rgbMargin };
}

/**
 * 선택된 키색과 그림의 불투명 픽셀 색들 간 "최소 정규화 RGB 거리"(0~1).
 * 크로마키 갇힌-배경 회수(reclaim)를 켤지/얼마나 세게 할지의 margin 게이트로 쓰인다.
 */
function minRgbDistToOpaque(frame: RgbaFrame, keyRgb: Rgb): number {
  const { data, width, height } = frame;
  const total = width * height;
  const step = Math.max(1, Math.floor(total / MAX_SAMPLES));
  let minD = 1;
  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    if (data[o + 3] < 16) continue; // 투명 픽셀 제외
    const d = rgbDistanceNorm({ r: data[o], g: data[o + 1], b: data[o + 2] }, keyRgb);
    if (d < minD) minD = d;
  }
  return minD;
}

function sampleOpaqueHsv(frame: RgbaFrame): Hsv[] {
  const { data, width, height } = frame;
  const total = width * height;
  const step = Math.max(1, Math.floor(total / MAX_SAMPLES));
  const out: Hsv[] = [];
  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    if (data[o + 3] < 16) continue; // 투명 픽셀 제외
    out.push(rgbToHsv(data[o], data[o + 1], data[o + 2]));
  }
  return out;
}
