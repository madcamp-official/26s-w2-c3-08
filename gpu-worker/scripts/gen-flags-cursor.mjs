// 깃발(시작/끝 공용 + 진짜시작·최종골 전용 긴깃대) + 3×1 바닥 세트 + 마우스 커서 UI 아이콘.
// docs/KJH/screen-design.md §126-137, shared/race/flagpole.ts(FLAGPOLE 상수)의 실측 수치를 그대로 씀:
//   poleHeightTiles=5(일반), longPoleHeightTiles=8(진짜 시작/골), baseWidthTiles=3(바닥, 항상 깃발과 세트).
// 깃발="에셋 아니라 라인 메타데이터"(flagpole.ts 주석) — Asset DB에 안 들어감, system 아이콘처럼
// asset-sources/system/에 정적 파일로만 존재. 손그림 wobbly 엔진은 gen-full-assets.mjs와 동일 원리
// (중복 최소화보다 기존 작동 코드 안 건드리는 걸 우선 — 그 파일의 팔레트/헬퍼를 그대로 복제).
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.join(ROOT, "asset-sources", "system");
mkdirSync(OUT, { recursive: true });
const TILE = 64;

// ---------- 팔레트 (gen-full-assets.mjs와 동일) ----------
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}
function buildPalette() {
  const grid = [];
  const hues = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  const sats = [85, 55];
  const lights = [25, 40, 55, 70, 85];
  const CHROMA_HUES = [120, 300, 180, 240];
  for (const h of hues) for (const s of sats) for (const l of lights) {
    const near = CHROMA_HUES.some((ch) => Math.min(Math.abs(h - ch), 360 - Math.abs(h - ch)) <= 6 && s >= 70 && l >= 40 && l <= 60);
    if (!near) grid.push({ h, s, l, hex: hslToHex(h, s, l) });
  }
  const gray = [10, 20, 30, 40, 50, 60, 70, 80, 90].map((l) => ({ h: 0, s: 0, l, hex: hslToHex(0, 0, l) }));
  return { grid, gray };
}
const PALETTE = buildPalette();
function pick(hueTarget, lightBand) {
  const hueDist = (h) => Math.min(Math.abs(h - hueTarget), 360 - Math.abs(h - hueTarget));
  const hueCands = PALETTE.grid.filter((c) => hueDist(c.h) <= 20);
  let cands = hueCands.filter((c) => c.l >= lightBand[0] && c.l <= lightBand[1]);
  if (cands.length === 0 && hueCands.length > 0) {
    const mid = (lightBand[0] + lightBand[1]) / 2;
    cands = [hueCands.reduce((a, b) => (Math.abs(a.l - mid) <= Math.abs(b.l - mid) ? a : b))];
  }
  return (cands[Math.floor(Math.random() * cands.length)] ?? PALETTE.grid[0]).hex;
}
function pickGray(lightBand) {
  let cands = PALETTE.gray.filter((c) => c.l >= lightBand[0] && c.l <= lightBand[1]);
  if (cands.length === 0) {
    const mid = (lightBand[0] + lightBand[1]) / 2;
    cands = [PALETTE.gray.reduce((a, b) => (Math.abs(a.l - mid) <= Math.abs(b.l - mid) ? a : b))];
  }
  return (cands[Math.floor(Math.random() * cands.length)] ?? PALETTE.gray[4]).hex;
}

// ---------- wobbly 엔진 (gen-full-assets.mjs와 동일) ----------
function wobblyRadialPoints(cx, cy, baseR, n, jitter, spikeChance = 0, spikeBoost = 1.3) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * (Math.PI / n) * 0.6;
    let r = baseR * (1 + (Math.random() - 0.5) * 2 * jitter);
    if (Math.random() < spikeChance) r *= spikeBoost;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}
function smoothClosedPath(pts) {
  const n = pts.length;
  const p = (i) => pts[((i % n) + n) % n];
  let d = `M ${p(0)[0].toFixed(1)} ${p(0)[1].toFixed(1)} `;
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} `;
  }
  return d + "Z";
}
function wobblyLinePath(x1, y1, x2, y2, wobble) {
  const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * wobble;
  const my = (y1 + y2) / 2 + (Math.random() - 0.5) * wobble;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
function blobShape(cx, cy, r, opts = {}) {
  const { n = 11, jitter = 0.13, spikeChance = 0, spikeBoost = 1.3 } = opts;
  return smoothClosedPath(wobblyRadialPoints(cx, cy, r, n, jitter, spikeChance, spikeBoost));
}
async function toPng(inner, W, H) {
  return sharp(Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`)).png().toBuffer();
}

// ============================================================================
// 깃발 — 마리오 체크포인트식, 초록. 기둥은 은회색, 꼭대기에 금색 구슬.
// poleTiles: shared/race/flagpole.ts FLAGPOLE.poleHeightTiles(5)/longPoleHeightTiles(8)를 그대로 받음.
// ============================================================================
async function genFlag(poleTiles) {
  const W = TILE, H = TILE * poleTiles;
  const poleColor = pickGray([55, 68]);
  const ballColor = pick(48, [65, 78]);
  const flagGreen = pick(120, [35, 45]);
  const flagDark = pick(120, [22, 30]);
  const poleX = W * 0.5;
  const poleTopY = H * 0.04;
  const poleBottomY = H * 0.98;
  const ballR = W * 0.11;

  // 기둥 — 살짝 구불구불한 손그림 선
  const pole = `<path d="${wobblyLinePath(poleX, poleTopY, poleX, poleBottomY, 5)}" stroke="${poleColor}" stroke-width="${W * 0.06}" stroke-linecap="round" fill="none"/>`;
  const ball = `<path d="${blobShape(poleX, poleTopY, ballR, { n: 9, jitter: 0.1 })}" fill="${ballColor}"/>`;

  // 깃발 천 — 기둥에서 오른쪽으로 뻗는 삼각 페넌트(직선 폴리곤 + 살짝 지터, 뒷변은 제비꼬리 노치로
  // "나부끼는" 느낌). smoothClosedPath(스플라인)는 점 5개론 뭉툭한 타원이 돼 깃발처럼 안 보여서 직선 사용.
  const flagTop = poleTopY + H * 0.06;
  const flagH = H * (poleTiles >= 8 ? 0.13 : 0.19);
  const flagW = W * 2.1;
  const jx = () => (Math.random() - 0.5) * 3;
  const jy = () => (Math.random() - 0.5) * 2;
  const p1 = [poleX, flagTop + jy()];
  const p2 = [poleX + flagW + jx(), flagTop + flagH * 0.42 + jy()];
  const p3 = [poleX + flagW * 0.62 + jx(), flagTop + flagH * 0.5 + jy()]; // 제비꼬리 노치(안쪽으로 파임)
  const p4 = [poleX + flagW + jx(), flagTop + flagH * 0.58 + jy()];
  const p5 = [poleX, flagTop + flagH + jy()];
  const flagPath = `M ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} L ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} L ${p3[0].toFixed(1)} ${p3[1].toFixed(1)} L ${p4[0].toFixed(1)} ${p4[1].toFixed(1)} L ${p5[0].toFixed(1)} ${p5[1].toFixed(1)} Z`;
  const flag = `<path d="${flagPath}" fill="${flagGreen}"/>
    <path d="${wobblyLinePath(poleX + flagW * 0.15, flagTop + flagH * 0.2, poleX + flagW * 0.5, flagTop + flagH * 0.35, 4)}" stroke="${flagDark}" stroke-width="${W * 0.02}" fill="none" opacity="0.5"/>`;

  return toPng(pole + flag + ball, W, H);
}

// ============================================================================
// 3×1 바닥 — 깃발과 항상 붙어다니는 기단(FLAGPOLE.baseWidthTiles=3). 갈색 흙 + 초록 잔디 상단.
// ============================================================================
async function genFloor3x1() {
  const W = TILE * 3, H = TILE;
  const dirt = pick(30, [32, 42]);
  const dirtDark = pick(30, [18, 26]);
  const grass = pick(115, [38, 48]);
  const grassLight = pick(115, [50, 60]);

  const pts = [[0, H * 0.32], [W, H * 0.32], [W, H], [0, H]];
  const body = `<path d="${smoothClosedPath(pts.map(([x, y]) => [x + (Math.random() - 0.5) * 3, y]))}" fill="${dirt}"/>`;

  // 잔디 상단 라인 — 살짝 울퉁불퉁
  const grassPts = [[0, H * 0.3], [W * 0.2, H * 0.24], [W * 0.4, H * 0.3], [W * 0.6, H * 0.22], [W * 0.8, H * 0.3], [W, H * 0.26], [W, H * 0.36], [0, H * 0.36]];
  const grassTop = `<path d="${smoothClosedPath(grassPts.map(([x, y]) => [x, y + (Math.random() - 0.5) * 2]))}" fill="${grass}"/>`;

  // 잔디 위 하이라이트 점들 + 흙 질감 점
  const specks = Array.from({ length: 5 }, () => {
    const x = Math.random() * W, y = H * 0.5 + Math.random() * H * 0.4;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2 + Math.random() * 2).toFixed(1)}" fill="${dirtDark}" opacity="0.4"/>`;
  }).join("");
  const grassSpecks = Array.from({ length: 4 }, () => {
    const x = Math.random() * W, y = H * 0.28 + Math.random() * H * 0.06;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" fill="${grassLight}" opacity="0.6"/>`;
  }).join("");

  return toPng(body + grassTop + specks + grassSpecks, W, H);
}

// ============================================================================
// 마우스 커서 — UI 오버레이 아이콘(월드 스프라이트 아님). hand-icon.png와 같은 예외로 테두리 허용
// (배경 위 어디서든 보여야 하므로). 클래식 화살표 포인터, 흰 몸통 + 어두운 외곽선.
// ============================================================================
async function genMouseCursor() {
  const W = 32, H = 32;
  const outline = "#1a1c1f";
  const body = "#f7f5f0";
  const shade = pickGray([70, 80]);

  const pts = [
    [4, 3], [4, 26], [10.5, 20.5], [14.5, 29], [18, 27.5], [14, 19.5], [23, 19],
  ];
  const arrow = `<path d="${smoothClosedPath(pts)}" fill="${body}" stroke="${outline}" stroke-width="1.6" stroke-linejoin="round"/>`;
  const shading = `<path d="${wobblyLinePath(6, 6, 9.5, 18, 2)}" stroke="${shade}" stroke-width="1.2" fill="none" opacity="0.5"/>`;

  return toPng(arrow + shading, W, H);
}

async function main() {
  writeFileSync(path.join(OUT, "flag-normal.png"), await genFlag(5));
  console.log("[생성] system/flag-normal.png (1x5타일, 일반 시작/끝 공용)");

  writeFileSync(path.join(OUT, "flag-long.png"), await genFlag(8));
  console.log("[생성] system/flag-long.png (1x8타일, 진짜 시작/최종 골 전용 — 긴 깃대)");

  writeFileSync(path.join(OUT, "floor-3x1.png"), await genFloor3x1());
  console.log("[생성] system/floor-3x1.png (3x1타일, 깃발 세트 기단)");

  writeFileSync(path.join(OUT, "mouse-cursor.png"), await genMouseCursor());
  console.log("[생성] system/mouse-cursor.png (32x32, UI 커서)");

  console.log("\n완료 — asset-sources/system/");
}

main().catch((e) => { console.error(e); process.exit(1); });
