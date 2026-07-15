// Stage 2.7(사전) — 원본 실루엣에서 팔/다리 유무 판단. 생성 전 소스 이미지만 보고 판단하므로
// LLM 게이트웨이 없이도(스텁 모드) 항상 동작 — 지금까지 프롬프트가 액션 무관하게 "arms swinging",
// "full body visible" 등을 하드코딩해 사지 없는 캐릭터도 Wan이 팔다리를 만들어내는 문제의 원인이었다
// (assemblePrompt.ts 참조). 여기서 판단한 결과로 그 문구를 조건부로 뺀다.
//
// 원리: "몸통은 굵고 사지는 가늘다"는 침식 기반 판단은 채워진(solid) 그림만 가정해 윤곽선(outline)
// 스케치에서 완전히 틀렸다(몸통 선도 사지 선만큼 가늚 — 5080 실측으로 확인, 지팡이 막대인간을 놓침).
// 대신 스켈레톤(Zhang-Suen 세선화)으로 1px 골격을 뽑고, 몸 중심(실루엣 중심)에서 가장 먼
// 골격 "끝점(extremity)"들을 찾는다 — 이 방식은 채워진 그림도 윤곽선 그림도 동일하게 다룬다
// (필요하면 세선화가 채워진 덩어리를 알아서 중심선으로 줄여준다). 몸통과 안 이어진 낙서 조각은
// BFS가 도달을 못 해 자동으로 제외된다(별도 노이즈 필터 불필요).
import type { RgbaFrame } from "../pipeline/types.js";
import { pngToFrame } from "../image/raster.js";
import { computeBBox } from "../stages/bbox.js";
import { pipelineConfig } from "../config/index.js";

export interface LimbDetection {
  hasArms: boolean;
  hasLegs: boolean;
  /** 디버깅·로깅용 — 분류된 끝점(extremity) 개수 */
  armCount: number;
  legCount: number;
}

export async function detectLimbsFromPng(sourcePng: Buffer): Promise<LimbDetection> {
  const frame = await pngToFrame(sourcePng);
  return detectLimbs(frame);
}

export function detectLimbs(frame: RgbaFrame): LimbDetection {
  const cfg = pipelineConfig.anatomy;
  const { width, height, data } = frame;
  const n = width * height;
  const none: LimbDetection = { hasArms: false, hasLegs: false, armCount: 0, legCount: 0 };

  const silhouette = new Uint8Array(n);
  let totalOpaque = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (data[p * 4 + 3] > cfg.alphaThreshold) {
        silhouette[p] = 1;
        totalOpaque++;
        sumX += x;
        sumY += y;
      }
    }
  }
  if (totalOpaque === 0) return none;

  const bbox = computeBBox(frame, cfg.alphaThreshold, 0);
  if (!bbox) return none;
  const bboxW = bbox.maxX - bbox.minX + 1;
  const bboxH = bbox.maxY - bbox.minY + 1;
  const diag = Math.hypot(bboxW, bboxH);
  const minReachPx = Math.max(2, diag * cfg.minReachRatio);

  const skeleton = zhangSuenThin(silhouette, width, height);

  // "몸 중심"에 가장 가까운 골격 픽셀을 BFS 시작점(root)으로 — 실제 무게중심(centroid) 기준.
  const centroidX = sumX / totalOpaque;
  const centroidY = sumY / totalOpaque;
  let root = -1;
  let bestD = Infinity;
  for (let p = 0; p < n; p++) {
    if (!skeleton[p]) continue;
    const x = p % width;
    const y = (p - x) / width;
    const d = Math.hypot(x - centroidX, y - centroidY);
    if (d < bestD) {
      bestD = d;
      root = p;
    }
  }
  if (root === -1) return none; // 세선화 후 골격이 통째로 사라진 극단적 케이스

  // BFS로 root의 연결요소만 도달(몸통과 안 이어진 낙서 조각은 자연히 제외) + parent/거리(hop 수) 기록.
  const dist = new Int32Array(n).fill(-1);
  const parent = new Int32Array(n).fill(-1);
  const order: number[] = [root];
  dist[root] = 0;
  let qi = 0;
  while (qi < order.length) {
    const p = order[qi++];
    const x = p % width;
    const y = (p - x) / width;
    for (const [dx, dy] of NEIGH8) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
      const np = yy * width + xx;
      if (!skeleton[np] || dist[np] !== -1) continue;
      dist[np] = dist[p] + 1;
      parent[np] = p;
      order.push(np);
    }
  }

  // 끝점(골격 이웃이 1개뿐인 픽셀) 중 root와 충분히 먼 것만 사지 후보 — 단, 판정은 끝점 위치만이
  // 아니라 root→끝점 경로 전체를 훑는다. 팔이 긴 소품(지팡이 등)으로 이어지면 끝점만으론 아래쪽
  // (다리 영역)으로 보이지만, 경로 중간(어깨~손)에서 분명 상체·수평 구간을 지나므로 그 구간에서
  // 팔로 잡힌다 — 한 가지(branch)가 팔 구간과 다리 구간을 동시에 지나도 각각 인정.
  let armCount = 0;
  let legCount = 0;
  const rootX = root % width;
  const rootY = Math.floor(root / width);
  for (const p of order) {
    if (skeletonDegree(skeleton, width, height, p) !== 1) continue;
    const tipX = p % width;
    const tipY = (p - tipX) / width;
    const reachPx = Math.hypot(tipX - rootX, tipY - rootY);
    if (reachPx < minReachPx) continue;

    const path: number[] = [];
    for (let cur = p; cur !== -1; cur = parent[cur]) path.push(cur);
    path.reverse(); // root ... tip

    const step = cfg.directionTracebackSteps;
    let branchHasArm = false;
    let branchHasLeg = false;
    for (let i = step; i < path.length; i++) {
      const cx = path[i] % width;
      const cy = (path[i] - cx) / width;
      const bx = path[i - step] % width;
      const by = (path[i - step] - bx) / width;
      const dx = cx - bx;
      const dy = cy - by;
      const relY = (cy - bbox.minY) / Math.max(1, bboxH - 1); // 0=위, 1=아래

      if (relY > cfg.legYThreshold && Math.abs(dy) >= Math.abs(dx)) branchHasLeg = true;
      else if (relY < cfg.armYThreshold && Math.abs(dx) > Math.abs(dy)) branchHasArm = true;
      // 그 외(머리 위로 뻗은 뾰족 머리카락 등 수직 상향)는 사지로 분류하지 않음.
    }
    if (branchHasArm) armCount++;
    if (branchHasLeg) legCount++;
  }

  return { hasArms: armCount > 0, hasLegs: legCount > 0, armCount, legCount };
}

const NEIGH8: ReadonlyArray<readonly [number, number]> = [
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

function skeletonDegree(mask: Uint8Array, width: number, height: number, p: number): number {
  const x = p % width;
  const y = (p - x) / width;
  let deg = 0;
  for (const [dx, dy] of NEIGH8) {
    const xx = x + dx;
    const yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
    if (mask[yy * width + xx]) deg++;
  }
  return deg;
}

/**
 * Zhang-Suen 세선화 — 표준 2-서브패스 반복 알고리즘. 이진 마스크를 1px 폭 골격으로 줄인다.
 * 채워진 덩어리든 이미 가는 윤곽선이든 동일하게 다뤄, "몸통이 두껍다"는 가정 없이 형태의
 * 중심선만 남긴다.
 */
function zhangSuenThin(mask: Uint8Array, width: number, height: number): Uint8Array {
  let img = mask.slice();
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= width || y >= height ? 0 : img[y * width + x]);

  let changed = true;
  while (changed) {
    changed = false;
    changed = thinPass(img, width, height, at, 1) || changed;
    changed = thinPass(img, width, height, at, 2) || changed;
  }
  return img;

  function thinPass(
    im: Uint8Array,
    w: number,
    h: number,
    sample: (x: number, y: number) => number,
    sub: 1 | 2,
  ): boolean {
    const toRemove: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (!im[p]) continue;
        const p2 = sample(x, y - 1);
        const p3 = sample(x + 1, y - 1);
        const p4 = sample(x + 1, y);
        const p5 = sample(x + 1, y + 1);
        const p6 = sample(x, y + 1);
        const p7 = sample(x - 1, y + 1);
        const p8 = sample(x - 1, y);
        const p9 = sample(x - 1, y - 1);
        const neighbors = [p2, p3, p4, p5, p6, p7, p8, p9];
        const B = neighbors.reduce((a, b) => a + b, 0);
        if (B < 2 || B > 6) continue;
        let A = 0;
        for (let i = 0; i < 8; i++) {
          if (neighbors[i] === 0 && neighbors[(i + 1) % 8] === 1) A++;
        }
        if (A !== 1) continue;
        if (sub === 1) {
          if (p2 * p4 * p6 !== 0) continue;
          if (p4 * p6 * p8 !== 0) continue;
        } else {
          if (p2 * p4 * p8 !== 0) continue;
          if (p2 * p6 * p8 !== 0) continue;
        }
        toRemove.push(p);
      }
    }
    for (const p of toRemove) im[p] = 0;
    return toRemove.length > 0;
  }
}
