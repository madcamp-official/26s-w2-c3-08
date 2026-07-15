// 손그림(꼬불꼬불) 벡터 UI의 핵심 — rough.js RoughGenerator 래퍼.
// 화면 부속품(버튼·바·카드·팝업)의 테두리·채움을 실제 크기에 맞춰 SVG path로 생성한다.
// 통짜 렌더가 아니라 path 문자열만 뽑아 React가 <path>로 선언적 렌더 → imperative DOM 조작 없음.
import rough from "roughjs";
import type { Options } from "roughjs/bin/core";

// 단일 제너레이터 재사용(상태 없음 — seed는 매 호출 옵션으로 주입).
const gen = rough.generator();

/** 화면 코드에 흩뿌리지 않기 위한 손그림 프리셋. roughness=꼬불정도, bowing=선 휨. */
// roughness/bowing이 크면 여러 겹 선이 심하게 엇나가 지저분해진다(피드백). 살짝 손그림 느낌만 나게 낮춤.
export const SKETCH = {
  /** 일반 테두리(버튼·카드·바). */
  frame: { roughness: 0.8, bowing: 0.7, strokeWidth: 2.2 },
  /** 작은 부속품(아이콘 칩·탭) — 과하지 않게. */
  chip: { roughness: 0.7, bowing: 0.6, strokeWidth: 2 },
  /** 팝업·안내판 테두리 — 조금 더 꼬불. */
  panel: { roughness: 1.0, bowing: 0.9, strokeWidth: 2.4 },
} as const;

export type SketchPreset = keyof typeof SKETCH;

export interface SketchPathInfo {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill?: string;
}

export interface BuildRectArgs {
  w: number;
  h: number;
  seed: number;
  /** 프리셋 or 직접 roughness/bowing/strokeWidth 지정 */
  preset?: SketchPreset;
  roughness?: number;
  bowing?: number;
  strokeWidth?: number;
  /** 테두리 색(잉크). 없으면 stroke 안 그림. */
  stroke?: string;
  /** 채움 색. 없으면 투명. */
  fill?: string;
  /** 채움 스타일 — 'solid'면 꽉, 아니면 해칭. 면 채움은 보통 solid. */
  fillStyle?: "solid" | "hachure" | "zigzag" | "cross-hatch";
  /** 모서리를 살짝 둥글게(라운드 사각형처럼) 보이게 하는 인셋. 기본 0(각짐). */
  radius?: number;
}

/**
 * 손그림 사각형(옵션상 라운드도 가능)을 그려 path 목록으로 반환.
 * radius>0이면 모서리를 자른 8각 경로로 그려 "둥근 손그림" 느낌을 낸다.
 */
export function buildRectPaths(args: BuildRectArgs): SketchPathInfo[] {
  const { w, h, seed, preset = "frame", stroke, fill, fillStyle = "solid", radius = 0 } = args;
  const base = SKETCH[preset];
  const opts: Options = {
    roughness: args.roughness ?? base.roughness,
    bowing: args.bowing ?? base.bowing,
    strokeWidth: args.strokeWidth ?? base.strokeWidth,
    seed,
    stroke: stroke ?? "none",
    fill,
    fillStyle,
    // 면 채움 밀도 — solid면 무시되지만 hachure 대비.
    fillWeight: 3,
    hachureGap: 6,
    // 테두리가 잘리지 않게 약간 안쪽으로.
    preserveVertices: true,
  };

  if (w <= 0 || h <= 0) return [];

  const inset = Math.max(1, (args.strokeWidth ?? base.strokeWidth) / 2 + 0.5);
  const x = inset;
  const y = inset;
  const rw = w - inset * 2;
  const rh = h - inset * 2;
  if (rw <= 0 || rh <= 0) return [];

  const drawable =
    radius > 0
      ? gen.path(roundedRectPath(x, y, rw, rh, Math.min(radius, rw / 2, rh / 2)), opts)
      : gen.rectangle(x, y, rw, rh, opts);

  return gen.toPaths(drawable);
}

/** 라운드 사각형의 SVG path d 문자열(rough가 이 경로를 손그림화). */
function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  return [
    `M${x + r},${y}`,
    `L${x + w - r},${y}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `L${x + w},${y + h - r}`,
    `Q${x + w},${y + h} ${x + w - r},${y + h}`,
    `L${x + r},${y + h}`,
    `Q${x},${y + h} ${x},${y + h - r}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    "Z",
  ].join(" ");
}

/** 새 랜덤 seed(지글지글 프레임 교체용). rough.newSeed()는 32bit 정수. */
export function newSeed(): number {
  return rough.newSeed();
}
