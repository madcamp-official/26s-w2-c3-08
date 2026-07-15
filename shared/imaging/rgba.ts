// 순수 RGBA 픽셀 유틸 — sharp 등 Node 전용 의존성 없이 버퍼만 다룬다.
// gpu-worker(크로마키 제거)와 server(업로드 소스 배경 분리)가 같은 로직을 공유하기 위해
// gpu-worker/src/stages/chromakeyRemoval.ts 에서 추출한 것. 원리는 그대로:
// 테두리 밴드 중앙값 = 배경색 추정 → 테두리發 flood fill로 "배경색에 가깝고 배경과 연결된"
// 영역만 투명화(캐릭터 내부 유사색 보존) → 테두리 분산이 크면 "단색 배경 아님" 신호.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** RGBA row-major 버퍼를 가진 이미지 — gpu-worker RgbaFrame과 구조적으로 호환 */
export interface RgbaImage {
  width: number;
  height: number;
  /** RGBA, row-major, 0~255. 길이 = width*height*4 */
  data: Uint8ClampedArray;
}

/** 정규화 RGB 유클리드 거리 (0~1). "배경과 같은 색인가" 판정용 */
const RGB_MAX_DIST = 255 * Math.sqrt(3);
export function rgbDistanceNorm(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db) / RGB_MAX_DIST;
}

/** 테두리 밴드 픽셀들의 채널별 중앙값 = 배경색, 정규화 분산 = 단색 신뢰도 */
export function estimateBorderColor(img: RgbaImage, band: number): { color: Rgb; varianceNorm: number } {
  const { data, width, height } = img;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const onBorder = x < band || y < band || x >= width - band || y >= height - band;
      if (!onBorder) continue;
      const o = (y * width + x) * 4;
      rs.push(data[o]);
      gs.push(data[o + 1]);
      bs.push(data[o + 2]);
    }
  }
  const color = { r: median(rs), g: median(gs), b: median(bs) };
  const varianceNorm = (chanVar(rs) + chanVar(gs) + chanVar(bs)) / 3 / (255 * 255);
  return { color, varianceNorm };
}

/**
 * 테두리에서 시작해 배경색에 가까운 연결 영역만 알파 0으로 (BFS).
 * @returns 투명화된 픽셀 수
 */
export function floodFillRemove(img: RgbaImage, bg: Rgb, threshold: number): number {
  const { data, width, height } = img;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  let removed = 0;

  const pushIfBg = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    const o = p * 4;
    const d = rgbDistanceNorm({ r: data[o], g: data[o + 1], b: data[o + 2] }, bg);
    if (d <= threshold) {
      data[o + 3] = 0; // 배경 → 투명
      removed++;
      queue.push(p);
    }
  };

  for (let x = 0; x < width; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfBg(0, y);
    pushIfBg(width - 1, y);
  }

  while (queue.length) {
    const p = queue.pop() as number;
    const x = p % width;
    const y = (p - x) / width;
    pushIfBg(x + 1, y);
    pushIfBg(x - 1, y);
    pushIfBg(x, y + 1);
    pushIfBg(x, y - 1);
  }
  return removed;
}

/** 남은 반투명 경계의 키색 기운 완화 — 각 픽셀에서 bg 방향 성분을 소폭 빼는 단순 디스필 */
export function despill(img: RgbaImage, bg: Rgb): void {
  const { data } = img;
  for (let o = 0; o < data.length; o += 4) {
    if (data[o + 3] === 0) continue;
    // bg가 지배적인 채널(예: 순녹이면 g)의 과한 값을 이웃 채널 최대치로 클램프해 기운을 뺀다
    if (bg.g > bg.r && bg.g > bg.b) data[o + 1] = Math.min(data[o + 1], Math.max(data[o], data[o + 2]));
    else if (bg.r > bg.g && bg.r > bg.b) data[o] = Math.min(data[o], Math.max(data[o + 1], data[o + 2]));
    else if (bg.b > bg.r && bg.b > bg.g) data[o + 2] = Math.min(data[o + 2], Math.max(data[o], data[o + 1]));
  }
}

/** 알파 통계 — "이미 투명 배경인가"(업로드 분기), "불투명 덩어리가 있긴 한가" 판정용 */
export function alphaStats(img: RgbaImage): { total: number; opaque: number; transparent: number; opaqueRatio: number } {
  const { data, width, height } = img;
  const total = width * height;
  let opaque = 0;
  let transparent = 0;
  for (let p = 0; p < total; p++) {
    const a = data[p * 4 + 3];
    if (a > 200) opaque++;
    else if (a < 16) transparent++;
  }
  return { total, opaque, transparent, opaqueRatio: opaque / Math.max(1, total) };
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function chanVar(xs: number[]): number {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / xs.length;
}
