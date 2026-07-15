// 프레임별 윤곽 추출 — 알파 채널 기준 외곽선을 한 번 뽑아 캐싱. 매 렌더 프레임마다 다시
// 계산하지 않는다(로드 직후 1회, §2026-07-16 설계: "테두리는 히트박스가 아니라 그림 윤곽을
// 따라가야 한다"). 히트박스(충돌)는 이 결과와 무관 — Body는 그대로 사각형.
import Phaser from "phaser";

export interface Point { x: number; y: number }

const ALPHA_THRESHOLD = 40;   // 0~255, 이보다 크면 "불투명"으로 취급
const SIMPLIFY_EPS = 1.4;     // px — 이보다 작은 편차의 점은 생략(Douglas-Peucker)

/** textureKey → 프레임 인덱스별 외곽 폴리곤(단순화됨, 로컬 픽셀 좌표계: 프레임 좌상단=0,0) */
const outlineCache = new Map<string, Point[][]>();

/** 이미 계산됐으면 캐시 반환, 아니면 계산 후 캐싱. 프레임이 없으면 빈 배열. */
export function getOutlines(scene: Phaser.Scene, texKey: string): Point[][] {
  const cached = outlineCache.get(texKey);
  if (cached) return cached;
  const polys = computeOutlines(scene, texKey);
  outlineCache.set(texKey, polys);
  return polys;
}

function computeOutlines(scene: Phaser.Scene, texKey: string): Point[][] {
  if (!scene.textures.exists(texKey)) return [];
  const tex = scene.textures.get(texKey);
  const frameNames = tex.getFrameNames(false);   // "__BASE" 제외, 스프라이트시트면 "0","1",... 숫자 문자열
  if (frameNames.length === 0) return [];
  const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  const polys: Point[][] = [];
  for (const name of frameNames) {
    const frame = tex.frames[name];
    if (!frame) continue;
    const idx = Number(name);
    if (!Number.isFinite(idx)) continue;   // 숫자가 아닌 프레임명(있을 리 없지만 방어)은 스킵
    canvas.width = frame.cutWidth;
    canvas.height = frame.cutHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      src as CanvasImageSource,
      frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
      0, 0, frame.cutWidth, frame.cutHeight,
    );
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const raw = traceOutline(data, canvas.width, canvas.height);
    polys[idx] = simplify(raw, SIMPLIFY_EPS);
  }
  return polys;
}

function isSolid(data: Uint8ClampedArray, w: number, h: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  return data[(y * w + x) * 4 + 3] > ALPHA_THRESHOLD;
}

/** Moore-neighbor 외곽선 추적 — 가장 위·왼쪽 불투명 픽셀에서 시작해 시계방향으로 한 바퀴. */
function traceOutline(data: Uint8ClampedArray, w: number, h: number): Point[] {
  let start: Point | null = null;
  outer: for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isSolid(data, w, h, x, y)) { start = { x, y }; break outer; }
    }
  }
  if (!start) return [];
  const dirs: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const pts: Point[] = [];
  let cur = start;
  let searchFrom = 7;   // 시작점은 위에서 스캔해 들어왔다고 가정 — 반시계 인덱스에서 탐색 시작
  const maxSteps = w * h * 4;
  let steps = 0;
  do {
    pts.push(cur);
    let found = false;
    for (let i = 0; i < 8; i++) {
      const dIdx = (searchFrom + i) % 8;
      const [dx, dy] = dirs[dIdx];
      const nx = cur.x + dx, ny = cur.y + dy;
      if (isSolid(data, w, h, nx, ny)) {
        cur = { x: nx, y: ny };
        searchFrom = (dIdx + 5) % 8;   // 들어온 방향의 반대쪽 이웃부터 다음 탐색(백트래킹 규칙)
        found = true;
        break;
      }
    }
    if (!found) break;
    steps++;
  } while (!(cur.x === start.x && cur.y === start.y) && steps < maxSteps);
  return pts;
}

function simplify(points: Point[], eps: number): Point[] {
  if (points.length < 3) return points;
  return douglasPeucker(points, eps);
}

function douglasPeucker(pts: Point[], eps: number): Point[] {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  let maxDist = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], a, b);
    if (d > maxDist) { maxDist = d; idx = i; }
  }
  if (maxDist > eps) {
    const left = douglasPeucker(pts.slice(0, idx + 1), eps);
    const right = douglasPeucker(pts.slice(idx), eps);
    return [...left.slice(0, -1), ...right];
  }
  return [a, b];
}

function perpDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}
