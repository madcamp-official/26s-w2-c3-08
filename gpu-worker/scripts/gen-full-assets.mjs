// asset-sources/manifest.mjs의 76개 전부를 실제로 그린다. 손그림 wobbly 브러시 엔진은
// gen-asset-prototype.mjs와 같은 원리(중복 최소화보다 기존 작동 코드 안 건드리는 걸 우선).
// 테두리 없음 원칙 동일(면 표시는 렌더 계층 몫). VPN/ComfyUI 불필요 — 순수 로컬 SVG 렌더.
import sharp from "sharp";
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ASSETS, SYSTEM_ICONS } from "../../asset-sources/manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.join(ROOT, "asset-sources");
const OLD = path.join(ROOT, "asset-prototype");
const TILE = 64;

// ---------- 팔레트 (gen-asset-prototype.mjs와 동일 원리) ----------
const CHROMA_HUES = [120, 300, 180, 240];
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

// ---------- wobbly 엔진 ----------
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
function wobblyOval(cx, cy, rx, ry, rot, n = 9, jitter = 0.12) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const j = 1 + (Math.random() - 0.5) * 2 * jitter;
    const ex = Math.cos(a) * rx * j, ey = Math.sin(a) * ry * j;
    pts.push([cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot)]);
  }
  return smoothClosedPath(pts);
}
async function toPng(inner, W, H) {
  return sharp(Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`)).png().toBuffer();
}

// ---------- 공용 휴머노이드 골격 (일부 몬스터가 재사용 — gen-asset-prototype.mjs와 동일 공식) ----------
function humanoidGeom(W, H, headR = W * 0.24) {
  const topY = H * 0.125;
  const faceDX = headR * 0.18;
  const headCx = W * 0.5 + faceDX * 0.4;
  const headCy = topY + headR * 1.05;
  const neckY = headCy + headR * 0.95;
  const torsoCy = neckY + H * 0.11;
  const torsoR = W * 0.27;
  const bibR = torsoR * 0.7;
  const bibCy = torsoCy + torsoR * 0.18;
  const hipY = torsoCy + torsoR * 0.85;
  const feetY = topY + H * 0.75;
  const cx = W * 0.5;
  const shoulderY = torsoCy - torsoR * 0.35;
  const handL = [cx - W * 0.24, shoulderY + H * 0.08];
  const handR = [cx + W * 0.4, shoulderY + H * 0.13];
  const footL = [cx - W * 0.04, feetY - H * 0.025];
  const footR = [cx + W * 0.26, feetY];
  return { W, H, headR, headCx, headCy, neckY, torsoCy, torsoR, bibR, bibCy, hipY, feetY, cx, shoulderY, handL, handR, footL, footR };
}
function humanoidBodySvg(g, { shirt, pants, skin, shoe, bib, button, eye = "#1a1c1f", withBib = true }) {
  const { W, H, headR, headCx, headCy, torsoCy, torsoR, bibR, bibCy, hipY, cx, shoulderY, handL, handR, footL, footR } = g;
  return `
  <path d="${wobblyLinePath(cx - W * 0.06, hipY, footL[0], footL[1], 4)}" stroke="${pants}" stroke-width="${W * 0.15}" stroke-linecap="round" fill="none"/>
  <path d="${wobblyLinePath(cx + W * 0.08, hipY, footR[0], footR[1], 4)}" stroke="${pants}" stroke-width="${W * 0.15}" stroke-linecap="round" fill="none"/>
  <path d="${blobShape(footL[0], footL[1], W * 0.1)}" fill="${shoe}"/>
  <path d="${blobShape(footR[0], footR[1], W * 0.1)}" fill="${shoe}"/>
  <path d="${wobblyLinePath(cx - torsoR * 0.6, shoulderY, handL[0], handL[1], 6)}" stroke="${shirt}" stroke-width="${W * 0.13}" stroke-linecap="round" fill="none"/>
  <path d="${wobblyLinePath(cx + torsoR * 0.6, shoulderY, handR[0], handR[1], 6)}" stroke="${shirt}" stroke-width="${W * 0.13}" stroke-linecap="round" fill="none"/>
  <path d="${blobShape(handL[0], handL[1], W * 0.09)}" fill="${skin}"/>
  <path d="${blobShape(handR[0], handR[1], W * 0.09)}" fill="${skin}"/>
  <path d="${blobShape(cx, torsoCy, torsoR, { jitter: 0.12 })}" fill="${shirt}"/>
  ${withBib ? `<path d="${blobShape(cx, bibCy, bibR, { jitter: 0.13 })}" fill="${bib}"/>
  <path d="${blobShape(cx - bibR * 0.28, bibCy + bibR * 0.15, W * 0.045)}" fill="${button}"/>
  <path d="${blobShape(cx + bibR * 0.28, bibCy + bibR * 0.15, W * 0.045)}" fill="${button}"/>` : ""}
  <path d="${blobShape(headCx, headCy, headR)}" fill="${skin}"/>
  <path d="${blobShape(headCx + headR * 0.06, headCy - headR * 0.1, headR * 0.14)}" fill="${eye}"/>
  <path d="${blobShape(headCx + headR * 0.4, headCy - headR * 0.06, headR * 0.12)}" fill="${eye}"/>`;
}

mkdirSync(OUT, { recursive: true });
for (const d of ["monster", "block", "background", "item", "avatar", "system"]) mkdirSync(path.join(OUT, d), { recursive: true });

// ============================================================================
// 몬스터 템플릿 — 형태 패밀리 재사용(blob/shell/spiky/humanoid/flying/multileg/bomb)
// ============================================================================
async function tplBlob(W, H, { body, dark, accent, spiky = false, eyeCount = 2, angry = false }) {
  const cx = W * 0.5, cy = H * 0.46, r = Math.min(W, H) * 0.36;
  const spikeChance = spiky ? 0.35 : 0;
  const bodyPath = blobShape(cx, cy, r, { n: 12, jitter: 0.13, spikeChance, spikeBoost: 1.3 });
  const footY = cy + r * 0.85;
  const eyes = eyeCount === 2
    ? `<path d="${blobShape(cx - r * 0.28, cy - r * 0.08, r * 0.16)}" fill="#f5f2ea"/>
       <path d="${blobShape(cx + r * 0.3, cy - r * 0.04, r * 0.14)}" fill="#f5f2ea"/>
       <path d="${blobShape(cx - r * 0.26, cy - r * 0.06, r * 0.07)}" fill="#1a1c1f"/>
       <path d="${blobShape(cx + r * 0.32, cy - r * 0.02, r * 0.06)}" fill="#1a1c1f"/>`
    : `<path d="${blobShape(cx + r * 0.1, cy - r * 0.05, r * 0.1)}" fill="#1a1c1f"/>`;
  const brows = angry
    ? `<path d="${wobblyLinePath(cx - r * 0.42, cy - r * 0.28, cx - r * 0.1, cy - r * 0.16, 4)}" stroke="${dark}" stroke-width="${W * 0.05}" stroke-linecap="round" fill="none"/>
       <path d="${wobblyLinePath(cx + r * 0.42, cy - r * 0.3, cx + r * 0.14, cy - r * 0.16, 4)}" stroke="${dark}" stroke-width="${W * 0.05}" stroke-linecap="round" fill="none"/>`
    : "";
  return `
  <path d="${blobShape(cx - r * 0.35, footY, r * 0.28, { n: 8, jitter: 0.16 })}" fill="${accent}"/>
  <path d="${blobShape(cx + r * 0.35, footY, r * 0.28, { n: 8, jitter: 0.16 })}" fill="${accent}"/>
  <path d="${bodyPath}" fill="${body}"/>
  <path d="${blobShape(cx, cy + r * 0.35, r * 0.5, { jitter: 0.15 })}" fill="${dark}" opacity="0.35"/>
  ${eyes}${brows}`;
}
async function genBlob(W, H, opts) { return toPng(await tplBlob(W, H, opts), W, H); }

async function tplShell(W, H, { skin, shell, dark }) {
  const cx = W * 0.5, cy = H * 0.5, r = Math.min(W, H) * 0.35;
  return `
  <path d="${blobShape(cx - r * 0.3, cy + r * 0.9, r * 0.22)}" fill="${skin}"/>
  <path d="${blobShape(cx + r * 0.3, cy + r * 0.9, r * 0.22)}" fill="${skin}"/>
  <path d="${blobShape(cx, cy, r, { jitter: 0.12 })}" fill="${skin}"/>
  <path d="${wobblyOval(cx, cy - r * 0.1, r * 0.85, r * 0.75, 0, 10, 0.1)}" fill="${shell}"/>
  <path d="${blobShape(cx, cy - r * 0.35, r * 0.32)}" fill="${dark}" opacity="0.4"/>
  <path d="${blobShape(cx - r * 0.15, cy - r * 0.65, r * 0.14)}" fill="#1a1c1f"/>
  <path d="${blobShape(cx + r * 0.2, cy - r * 0.6, r * 0.13)}" fill="#1a1c1f"/>`;
}
async function genShell(W, H, opts) { return toPng(await tplShell(W, H, opts), W, H); }

async function tplFlying(W, H, { body, dark, ghostly = false }) {
  const cx = W * 0.5, cy = H * 0.45, r = Math.min(W, H) * 0.35;
  const bottom = ghostly
    ? Array.from({ length: 4 }, (_, i) => {
        const x = cx - r * 0.75 + i * (r * 0.5);
        return `<path d="${blobShape(x, cy + r * 0.75, r * 0.28, { n: 6, jitter: 0.2 })}" fill="${body}"/>`;
      }).join("")
    : "";
  return `
  <path d="${wobblyOval(cx - r * 1.1, cy, r * 0.4, r * 0.55, 0.3, 7, 0.15)}" fill="${body}" opacity="0.85"/>
  <path d="${wobblyOval(cx + r * 1.1, cy, r * 0.4, r * 0.55, -0.3, 7, 0.15)}" fill="${body}" opacity="0.85"/>
  ${ghostly ? bottom : `<path d="${blobShape(cx - r * 0.3, cy + r * 0.85, r * 0.16)}" fill="${dark}"/><path d="${blobShape(cx + r * 0.3, cy + r * 0.85, r * 0.16)}" fill="${dark}"/>`}
  <path d="${blobShape(cx, cy, r, { jitter: 0.13 })}" fill="${body}"/>
  <path d="${blobShape(cx - r * 0.25, cy - r * 0.05, r * 0.15)}" fill="#f5f2ea"/>
  <path d="${blobShape(cx + r * 0.28, cy - r * 0.02, r * 0.13)}" fill="#f5f2ea"/>
  <path d="${blobShape(cx - r * 0.23, cy - r * 0.03, r * 0.06)}" fill="#1a1c1f"/>
  <path d="${blobShape(cx + r * 0.3, cy, r * 0.05)}" fill="#1a1c1f"/>`;
}
async function genFlying(W, H, opts) { return toPng(await tplFlying(W, H, opts), W, H); }

async function tplMultileg(W, H, { body, dark, legCount = 6 }) {
  const cx = W * 0.5, cy = H * 0.5, r = Math.min(W, H) * 0.28;
  const legs = Array.from({ length: legCount }, (_, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const a = side * (0.5 + row * 0.35);
    const x1 = cx + Math.cos(a) * r * 0.7, y1 = cy + Math.sin(a) * r * 0.3;
    const x2 = cx + Math.cos(a) * r * 2.2, y2 = cy + Math.sin(a) * r * 1.6 + r * 0.6;
    return `<path d="${wobblyLinePath(x1, y1, x2, y2, 6)}" stroke="${dark}" stroke-width="${W * 0.035}" stroke-linecap="round" fill="none"/>`;
  }).join("\n");
  return `
  ${legs}
  <path d="${blobShape(cx, cy, r, { jitter: 0.14, spikeChance: 0.15, spikeBoost: 1.2 })}" fill="${body}"/>
  <path d="${blobShape(cx - r * 0.3, cy - r * 0.1, r * 0.12)}" fill="#f5f2ea"/>
  <path d="${blobShape(cx + r * 0.3, cy - r * 0.1, r * 0.12)}" fill="#f5f2ea"/>
  <path d="${blobShape(cx - r * 0.3, cy - r * 0.1, r * 0.05)}" fill="#1a1c1f"/>
  <path d="${blobShape(cx + r * 0.3, cy - r * 0.1, r * 0.05)}" fill="#1a1c1f"/>`;
}
async function genMultileg(W, H, opts) { return toPng(await tplMultileg(W, H, opts), W, H); }

async function tplBomb(W, H, { body, dark, fuse }) {
  const cx = W * 0.5, cy = H * 0.56, r = Math.min(W, H) * 0.34;
  return `
  <path d="${blobShape(cx - r * 0.3, cy + r * 0.85, r * 0.18)}" fill="${dark}"/>
  <path d="${blobShape(cx + r * 0.3, cy + r * 0.85, r * 0.18)}" fill="${dark}"/>
  <path d="${blobShape(cx, cy, r, { jitter: 0.11 })}" fill="${body}"/>
  <path d="${wobblyLinePath(cx, cy - r * 0.95, cx + r * 0.25, cy - r * 1.4, 5)}" stroke="${fuse}" stroke-width="${W * 0.04}" stroke-linecap="round" fill="none"/>
  <path d="${blobShape(cx - r * 0.25, cy - r * 0.05, r * 0.14)}" fill="#f5f2ea"/>
  <path d="${blobShape(cx + r * 0.28, cy - r * 0.02, r * 0.12)}" fill="#f5f2ea"/>
  <path d="${blobShape(cx - r * 0.23, cy - r * 0.03, r * 0.06)}" fill="#1a1c1f"/>
  <path d="${blobShape(cx + r * 0.3, cy, r * 0.05)}" fill="#1a1c1f"/>`;
}
async function genBomb(W, H, opts) { return toPng(await tplBomb(W, H, opts), W, H); }

async function genHumanoidMonster(W, H, { shirt, pants, skin, shoe, headAccessory }) {
  const g = humanoidGeom(W, H, W * 0.22);
  const body = humanoidBodySvg(g, { shirt, pants, skin, shoe, bib: pants, button: pants });
  const extra = headAccessory ? headAccessory(g) : "";
  return toPng(body + extra, W, H);
}

// ---------- 경사 — shared/physics/terrain.ts 실제 충돌 형태(dir=1 오른쪽 오름)와 일치하는
// 직각삼각형. gen-asset-prototype.mjs와 동일 로직(이미 실측 검증됨).
//   floor-asc(◢): 좌하-우하-우상 / floor-desc(◣): 좌하-우하-좌상
//   ceil-desc(◥): 좌상-우상-우하 / ceil-asc(◤): 좌상-우상-좌하
function slopeCorners(dir, W, H) {
  const BL = [0, H], BR = [W, H], TL = [0, 0], TR = [W, 0];
  switch (dir) {
    case "floor-asc": return { corners: [BL, BR, TR], hypotenuse: [BL, TR] };
    case "floor-desc": return { corners: [BL, BR, TL], hypotenuse: [BR, TL] };
    case "ceil-desc": return { corners: [TL, TR, BR], hypotenuse: [TL, BR] };
    case "ceil-asc": return { corners: [TL, TR, BL], hypotenuse: [TR, BL] };
  }
}
function wobblySlopePath(dir, W, H, jitterPx, subdivisions = 7) {
  const { corners } = slopeCorners(dir, W, H);
  const [c0, c1, c2] = corners;
  const hypoStart = c2, hypoEnd = c0;
  const hypoPts = [];
  for (let i = 1; i < subdivisions; i++) {
    const t = i / subdivisions;
    const x = hypoStart[0] + (hypoEnd[0] - hypoStart[0]) * t;
    const y = hypoStart[1] + (hypoEnd[1] - hypoStart[1]) * t;
    const nx = -(hypoEnd[1] - hypoStart[1]), ny = hypoEnd[0] - hypoStart[0];
    const nlen = Math.hypot(nx, ny) || 1;
    const off = (Math.random() - 0.5) * 2 * jitterPx;
    hypoPts.push([x + (nx / nlen) * off, y + (ny / nlen) * off]);
  }
  const pts = [c0, c1, c2, ...hypoPts];
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} `;
  for (let i = 1; i < pts.length; i++) d += `L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} `;
  return d + "Z";
}
async function genSlope(dir, W, H, fillHue, surfaceHue) {
  const fill = pick(fillHue, [30, 42]);
  const surface = pick(surfaceHue, [50, 65]);
  const dark = pick(fillHue, [15, 22]);
  const strokeW = Math.max(3, Math.round(Math.min(W, H) * 0.06));
  const body = wobblySlopePath(dir, W, H, Math.min(W, H) * 0.035);
  const { hypotenuse } = slopeCorners(dir, W, H);
  const [hs, he] = hypotenuse;
  const surfaceLine = wobblyLinePath(hs[0], hs[1], he[0], he[1], Math.min(W, H) * 0.06);
  return toPng(
    `<path d="${body}" fill="${fill}"/>
     <path d="${wobblyLinePath((hs[0]+he[0])/2 - (he[0]-hs[0])*0.15, (hs[1]+he[1])/2 - (he[1]-hs[1])*0.15, (hs[0]+he[0])/2 + (he[0]-hs[0])*0.15, (hs[1]+he[1])/2 + (he[1]-hs[1])*0.15, Math.min(W,H)*0.08)}" stroke="${dark}" stroke-width="${strokeW}" opacity="0.35" fill="none"/>
     <path d="${surfaceLine}" stroke="${surface}" stroke-width="${strokeW * 1.4}" stroke-linecap="round" fill="none"/>`,
    W, H,
  );
}

// ============================================================================
// 블록 템플릿 — 하나로 대부분 커버(단색 판 + 선택적 아이콘 오버레이)
// ============================================================================
async function tplBlockBase(W, H, { fill, dark, pattern = "plain" }) {
  const pts = [[W * 0.06, H * 0.06], [W * 0.94, H * 0.06], [W * 0.94, H * 0.94], [W * 0.06, H * 0.94]];
  const jittered = pts.map(([x, y]) => [x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4]);
  const path = smoothClosedPath(jittered);
  let deco = "";
  if (pattern === "brick") {
    deco = `<path d="${wobblyLinePath(W * 0.08, H * 0.5, W * 0.92, H * 0.5, 3)}" stroke="${dark}" stroke-width="${W * 0.025}" fill="none" opacity="0.5"/>
      <path d="${wobblyLinePath(W * 0.35, H * 0.08, W * 0.35, H * 0.5, 3)}" stroke="${dark}" stroke-width="${W * 0.02}" fill="none" opacity="0.5"/>
      <path d="${wobblyLinePath(W * 0.65, H * 0.5, W * 0.65, H * 0.92, 3)}" stroke="${dark}" stroke-width="${W * 0.02}" fill="none" opacity="0.5"/>`;
  } else if (pattern === "metal") {
    deco = `<path d="${blobShape(W * 0.5, H * 0.5, Math.min(W, H) * 0.06)}" fill="${dark}" opacity="0.4"/>`;
  }
  return `<path d="${path}" fill="${fill}"/>${deco}`;
}
async function genBlockIcon(W, H, { fill, dark, pattern, iconFn }) {
  const base = await tplBlockBase(W, H, { fill, dark, pattern });
  const icon = iconFn ? iconFn(W, H) : "";
  return toPng(base + icon, W, H);
}

// ============================================================================
// 배경 템플릿 — docs/KJH/screen-design.md §453 확정: BackgroundAttrs.size는 "라인을 덮는 크기"가
// 아니라 "반복 타일링되는 패턴 한 단위 크기" — 이 이미지가 라인 전체에 가로로 반복돼 깔린다.
// ⚠️ 그러므로 좌우 경계가 완벽히 이어져야 함(seamless) — 안 그러면 반복할 때마다 이음새가 끊겨
// 보인다. 땅 실루엣의 시작점(x=0)과 끝점(x=W) 높이를 강제로 같게 고정해 보장하고, 장식 요소는
// 타일 경계(좌우 5%)를 넘지 않게 배치해 wrap 시 어색한 절단이 없게 한다.
// ============================================================================
async function genBackground(W, H, { sky, ground, silhouette, theme }) {
  const groundY = H * 0.7;
  const n = 6;
  const edgeY = groundY - Math.random() * H * 0.05; // 좌우 공용 높이(seam 고정)
  const hillsPts = [[0, edgeY]];
  for (let i = 1; i < n; i++) {
    hillsPts.push([(i / n) * W, groundY - Math.random() * H * 0.09]);
  }
  hillsPts.push([W, edgeY]); // 오른쪽 끝을 왼쪽 끝과 강제로 동일하게 — 타일링 이음새 제거
  let hillsPath = `M 0 ${H} `;
  for (const [x, y] of hillsPts) hillsPath += `L ${x.toFixed(1)} ${y.toFixed(1)} `;
  hillsPath += `L ${W} ${H} Z`;

  // 장식은 타일 경계(좌우 5%) 안쪽에서만 — wrap 시 잘려 보이는 것 방지
  const marginX = W * 0.05;
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);

  const decor = THEME_DECOR[theme](W, H, groundY, marginX, silhouette, rand);

  return toPng(
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${sky}"/>
     ${decor.behind ?? ""}
     <path d="${hillsPath}" fill="${ground}"/>
     ${decor.front ?? ""}`,
    W, H,
  );
}

/** 테마별 장식 — 하늘(behind, 땅 그리기 전) / 땅 위(front, 땅 그린 후) 분리 */
const THEME_DECOR = {
  grassland(W, H, groundY, mX, color, rand) {
    const clouds = Array.from({ length: 3 }, () =>
      `<path d="${wobblyOval(rand(mX, W - mX), rand(H * 0.1, H * 0.28), W * 0.09, H * 0.045, 0, 8, 0.15)}" fill="#ffffff" opacity="0.8"/>`
    ).join("");
    const bushes = Array.from({ length: 4 }, () => {
      const cx = rand(mX, W - mX), r = Math.min(W, H) * rand(0.04, 0.07);
      return `<path d="${blobShape(cx, groundY - r * 0.3, r, { n: 9, jitter: 0.18 })}" fill="${color}" opacity="0.7"/>`;
    }).join("");
    return { behind: clouds, front: bushes };
  },
  cave(W, H, groundY, mX, color, rand) {
    const stalactites = Array.from({ length: 4 }, () => {
      const cx = rand(mX, W - mX), len = rand(H * 0.12, H * 0.24), w = rand(W * 0.03, W * 0.06);
      const tipY = len, x1 = cx - w, x2 = cx + w;
      return `<path d="M ${x1.toFixed(1)} 0 L ${(cx + (Math.random() - 0.5) * 6).toFixed(1)} ${tipY.toFixed(1)} L ${x2.toFixed(1)} 0 Z" fill="${color}"/>`;
    }).join("");
    const stalagmites = Array.from({ length: 4 }, () => {
      const cx = rand(mX, W - mX), len = rand(H * 0.1, H * 0.2), w = rand(W * 0.035, W * 0.06);
      const tipY = groundY - len;
      return `<path d="M ${(cx - w).toFixed(1)} ${groundY.toFixed(1)} L ${(cx + (Math.random() - 0.5) * 6).toFixed(1)} ${tipY.toFixed(1)} L ${(cx + w).toFixed(1)} ${groundY.toFixed(1)} Z" fill="${color}"/>`;
    }).join("");
    return { behind: stalactites, front: stalagmites };
  },
  castle(W, H, groundY, mX, color, rand) {
    const crenels = Array.from({ length: 6 }, (_, i) => {
      const cx = mX + (i / 5) * (W - 2 * mX), w = W * 0.04;
      return `<rect x="${(cx - w / 2).toFixed(1)}" y="${(groundY - H * 0.06).toFixed(1)}" width="${w.toFixed(1)}" height="${(H * 0.06).toFixed(1)}" fill="${color}"/>`;
    }).join("");
    const windows = Array.from({ length: 3 }, () => {
      const cx = rand(mX, W - mX), cy = groundY + rand(H * 0.06, H * 0.2);
      return `<path d="${blobShape(cx, cy, Math.min(W, H) * 0.035, { n: 6, jitter: 0.1 })}" fill="${color}" opacity="0.8"/>`;
    }).join("");
    return { front: crenels + windows };
  },
  "night-sky"(W, H, groundY, mX, color, rand) {
    const moon = `<path d="${blobShape(W * 0.78, H * 0.2, Math.min(W, H) * 0.09, { n: 10, jitter: 0.06 })}" fill="${color}" opacity="0.9"/>`;
    const stars = Array.from({ length: 8 }, () => {
      const cx = rand(mX, W - mX), cy = rand(H * 0.05, H * 0.55);
      return `<path d="${blobShape(cx, cy, Math.min(W, H) * rand(0.008, 0.018), { n: 5, jitter: 0.1 })}" fill="${color}" opacity="0.9"/>`;
    }).join("");
    return { behind: moon + stars };
  },
  underwater(W, H, groundY, mX, color, rand) {
    const bubbles = Array.from({ length: 6 }, () => {
      const cx = rand(mX, W - mX), cy = rand(H * 0.08, H * 0.55);
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(Math.min(W, H) * rand(0.012, 0.025)).toFixed(1)}" fill="#ffffff" opacity="0.5"/>`;
    }).join("");
    const coral = Array.from({ length: 4 }, () => {
      const cx = rand(mX, W - mX), len = rand(H * 0.1, H * 0.22);
      return `<path d="${wobblyLinePath(cx, groundY, cx + rand(-10, 10), groundY - len, 8)}" stroke="${color}" stroke-width="${W * 0.025}" stroke-linecap="round" fill="none" opacity="0.8"/>`;
    }).join("");
    return { behind: bubbles, front: coral };
  },
};

// ============================================================================
// 아이템 템플릿
// ============================================================================
async function genGiantMushroom(W, H) {
  const capC = pick(0, [42, 52]), capSpot = pickGray([90, 97]), stem = pick(35, [65, 78]);
  const cx = W * 0.5, capCy = H * 0.4, capR = Math.min(W, H) * 0.34;
  return toPng(
    `<path d="${blobShape(cx, H * 0.72, capR * 0.42, { n: 8, jitter: 0.14 })}" fill="${stem}"/>
     <path d="${wobblyOval(cx, capCy, capR, capR * 0.68, 0, 10, 0.1)}" fill="${capC}"/>
     <path d="${blobShape(cx - capR * 0.4, capCy - capR * 0.15, capR * 0.16)}" fill="${capSpot}"/>
     <path d="${blobShape(cx + capR * 0.35, capCy - capR * 0.05, capR * 0.14)}" fill="${capSpot}"/>
     <path d="${blobShape(cx, capCy - capR * 0.35, capR * 0.12)}" fill="${capSpot}"/>`,
    W, H,
  );
}
async function genSpeedBoost(W, H) {
  const bolt = pick(48, [55, 68]), glow = pick(48, [75, 85]);
  const cx = W * 0.5, cy = H * 0.5, s = Math.min(W, H) * 0.4;
  const pts = [[cx + s * 0.1, cy - s], [cx - s * 0.5, cy + s * 0.15], [cx - s * 0.05, cy + s * 0.15], [cx - s * 0.3, cy + s], [cx + s * 0.5, cy - s * 0.15], [cx + s * 0.05, cy - s * 0.15]];
  const jittered = pts.map(([x, y]) => [x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4]);
  return toPng(
    `<path d="${blobShape(cx, cy, s * 1.1, { n: 8, jitter: 0.15 })}" fill="${glow}" opacity="0.4"/>
     <path d="${smoothClosedPath(jittered)}" fill="${bolt}"/>`,
    W, H,
  );
}

// ============================================================================
// 매니페스트 실행 — 카테고리별 분기해서 실제로 그린다
// ============================================================================
const MONSTER_SPECS = {
  goomba: null, // 기존 프로토타입 재사용(복사)
  koopa: (W, H) => genShell(W, H, { skin: pick(120, [45, 55]), shell: pick(30, [40, 50]), dark: pickGray([15, 22]) }),
  "buzzy-beetle": (W, H) => genBlob(W, H, { body: pickGray([25, 35]), dark: pickGray([10, 18]), accent: pickGray([15, 22]), spiky: true, eyeCount: 2 }),
  spiny: (W, H) => genBlob(W, H, { body: pick(0, [42, 52]), dark: pick(0, [22, 30]), accent: pickGray([20, 28]), spiky: true, angry: true }),
  piranha: null,
  boo: (W, H) => genFlying(W, H, { body: pickGray([88, 96]), dark: pickGray([70, 80]), ghostly: true }),
  "bob-omb": (W, H) => genBomb(W, H, { body: pickGray([15, 25]), dark: pickGray([8, 15]), fuse: pick(35, [50, 60]) }),
  "chain-chomp": null,
  lakitu: (W, H) => genFlying(W, H, { body: pickGray([88, 96]), dark: pick(45, [55, 65]), ghostly: true }),
  "hammer-bro": (W, H) => genHumanoidMonster(W, H, {
    shirt: pick(120, [35, 45]), pants: pickGray([20, 30]), skin: pick(30, [50, 60]), shoe: pickGray([15, 22]),
    headAccessory: (g) => `<path d="${blobShape(g.headCx, g.headCy - g.headR * 0.7, g.headR * 0.7)}" fill="${pickGray([15, 22])}"/>`,
  }),
  "straight-shooter": (W, H) => genHumanoidMonster(W, H, {
    shirt: pick(210, [40, 50]), pants: pickGray([25, 35]), skin: pick(30, [50, 60]), shoe: pickGray([15, 22]),
  }),
  "tracker-homing": (W, H) => genFlying(W, H, { body: pick(280, [45, 55]), dark: pick(280, [25, 33]), ghostly: false }),
  "king-splitter": (W, H) => genBlob(W, H, { body: pick(90, [55, 65]), dark: pick(90, [30, 40]), accent: pick(90, [40, 50]) }),
  "teleport-boss": (W, H) => genHumanoidMonster(W, H, {
    shirt: pick(280, [30, 40]), pants: pickGray([15, 25]), skin: pick(280, [55, 65]), shoe: pickGray([10, 18]),
    headAccessory: (g) => `<path d="${blobShape(g.headCx, g.headCy - g.headR * 0.8, g.headR * 0.5, { spikeChance: 0.5, spikeBoost: 1.6 })}" fill="${pick(280, [30, 40])}"/>`,
  }),
  creeper: (W, H) => genHumanoidMonster(W, H, { shirt: pick(115, [35, 45]), pants: pick(115, [35, 45]), skin: pick(115, [35, 45]), shoe: pick(115, [15, 22]) }),
  zombie: (W, H) => genHumanoidMonster(W, H, { shirt: pick(100, [35, 45]), pants: pickGray([25, 35]), skin: pick(100, [40, 50]), shoe: pickGray([15, 22]) }),
  spider: (W, H) => genMultileg(W, H, { body: pickGray([12, 20]), dark: pickGray([8, 15]), legCount: 8 }),
  enderman: (W, H) => genHumanoidMonster(W, H, { shirt: pickGray([8, 15]), pants: pickGray([8, 15]), skin: pickGray([8, 15]), shoe: pickGray([5, 12]) }),
  "trampoline-ball": (W, H) => genBlob(W, H, { body: pick(140, [55, 65]), dark: pick(140, [30, 40]), accent: pick(140, [40, 50]) }),
  "shy-fleer": (W, H) => genBlob(W, H, { body: pick(340, [60, 70]), dark: pick(340, [35, 45]), accent: pick(340, [45, 55]) }),
  "hop-syncer": (W, H) => genBlob(W, H, { body: pick(190, [50, 60]), dark: pick(190, [28, 38]), accent: pick(190, [38, 48]) }),
  enrager: (W, H) => genBlob(W, H, { body: pick(15, [45, 55]), dark: pick(15, [25, 33]), accent: pick(15, [33, 42]), angry: true }),
  "pushable-crate-mob": (W, H) => genBlockIcon(W, H, { fill: pick(35, [40, 50]), dark: pick(35, [22, 30]), pattern: "brick" }),
  "boss-big": (W, H) => genHumanoidMonster(W, H, { shirt: pick(0, [35, 45]), pants: pickGray([15, 25]), skin: pick(30, [50, 60]), shoe: pickGray([10, 18]) }),
};

const BLOCK_ICONS = {
  brick: () => "", "question-block": (W, H) => `<path d="${blobShape(W * 0.5, H * 0.5, Math.min(W, H) * 0.12)}" fill="${pick(48, [70, 82])}"/>`,
  "ice-block": () => "",
  "breakable-block": (W, H) => `<path d="${wobblyLinePath(W * 0.2, H * 0.3, W * 0.8, H * 0.75, 8)}" stroke="${pickGray([10, 18])}" stroke-width="${W * 0.03}" fill="none" opacity="0.6"/>`,
  "falling-platform": () => "", "moving-platform": () => "",
  "pendulum-hazard": (W, H) => `<path d="${blobShape(W * 0.5, H * 0.5, Math.min(W, H) * 0.28, { spikeChance: 0.4, spikeBoost: 1.4 })}" fill="${pickGray([15, 25])}"/>`,
  "spin-fireball": (W, H) => `<path d="${blobShape(W * 0.5, H * 0.5, Math.min(W, H) * 0.3, { spikeChance: 0.3, spikeBoost: 1.5 })}" fill="${pick(30, [50, 60])}"/>`,
  "charge-block": (W, H) => `<path d="${wobblyLinePath(W * 0.5, H * 0.2, W * 0.5, H * 0.8, 4)}" stroke="${pick(0, [40, 50])}" stroke-width="${W * 0.06}" stroke-linecap="round" fill="none"/>`,
  spring: (W, H) => Array.from({ length: 4 }, (_, i) => `<path d="${wobblyLinePath(W * 0.25, H * (0.3 + i * 0.12), W * 0.75, H * (0.36 + i * 0.12), 6)}" stroke="${pick(0, [42, 52])}" stroke-width="${W * 0.05}" stroke-linecap="round" fill="none"/>`).join(""),
  "updraft-fan": (W, H) => `<path d="${blobShape(W * 0.5, H * 0.5, Math.min(W, H) * 0.25, { n: 6, jitter: 0.1 })}" fill="${pick(190, [55, 65])}" opacity="0.7"/>`,
  "conveyor-belt": (W, H) => Array.from({ length: 3 }, (_, i) => `<path d="${wobblyLinePath(W * (0.2 + i * 0.28), H * 0.5, W * (0.32 + i * 0.28), H * 0.5, 3)}" stroke="${pickGray([20, 30])}" stroke-width="${W * 0.025}" fill="none"/>`).join(""),
  "dash-panel": (W, H) => `<path d="${wobblyLinePath(W * 0.25, H * 0.5, W * 0.7, H * 0.5, 4)}" stroke="${pick(30, [50, 60])}" stroke-width="${W * 0.06}" stroke-linecap="round" fill="none"/>`,
  "cannon-straight": (W, H) => `<path d="${blobShape(W * 0.5, H * 0.35, Math.min(W, H) * 0.18)}" fill="${pickGray([15, 25])}"/>`,
  "cannon-homing": (W, H) => `<path d="${blobShape(W * 0.5, H * 0.35, Math.min(W, H) * 0.18)}" fill="${pickGray([15, 25])}"/><path d="${blobShape(W * 0.5, H * 0.35, Math.min(W, H) * 0.06)}" fill="${pick(0, [45, 55])}"/>`,
  "switch-block-on": (W, H) => `<path d="${blobShape(W * 0.5, H * 0.4, Math.min(W, H) * 0.1)}" fill="${pick(48, [65, 75])}"/>`,
  "switch-block-off": (W, H) => `<path d="${blobShape(W * 0.5, H * 0.4, Math.min(W, H) * 0.1)}" fill="${pickGray([25, 35])}"/>`,
  "blink-block": () => "", "hidden-block": () => "",
  "spike-row": (W, H) => Array.from({ length: 5 }, (_, i) => `<path d="${blobShape(W * (0.1 + i * 0.2), H * 0.7, Math.min(W, H) * 0.11, { n: 5, jitter: 0.1 })}" fill="${pickGray([70, 82])}"/>`).join(""),
  icicle: (W, H) => `<path d="${blobShape(W * 0.5, H * 0.3, Math.min(W, H) * 0.2, { n: 5, jitter: 0.12 })}" fill="${pick(200, [70, 82])}"/>`,
  "corner-wall": () => "", "ride-start": () => "", "ride-oneway": () => "",
  "breakblocks-block": (W, H) => `<path d="${wobblyLinePath(W * 0.2, H * 0.2, W * 0.8, H * 0.8, 8)}" stroke="${pickGray([10, 18])}" stroke-width="${W * 0.04}" fill="none" opacity="0.7"/>`,
};

async function main() {
  const manifestByFile = new Map(ASSETS.map((a) => [a.file, a]));

  // 1) 기존 프로토타입 재배치(리네임 복사)
  const rename = {
    "goomba-1x1.png": "monster/goomba.png",
    "piranha-1x2.png": "monster/piranha.png",
    "chainchomp-2x2.png": "monster/chain-chomp.png",
    "slope-floorasc-2x2.png": "block/slope-floor-asc.png",
    "slope-ceildesc-2x2.png": "block/slope-ceil-desc.png",
    "hand-icon.png": "system/hand-icon.png",
  };
  for (const [src, dst] of Object.entries(rename)) {
    const srcPath = path.join(OLD, src);
    const dstPath = path.join(OUT, dst);
    if (existsSync(srcPath)) { copyFileSync(srcPath, dstPath); console.log("[재배치]", dst); }
  }
  for (const id of ["mario", "luigi", "princess", "toad", "gorilla", "mouse", "goose", "croc", "steve", "creeper", "speedster", "kirby", "robot", "turtleninja", "knight", "pirate"]) {
    const num = ["mario", "luigi", "princess", "toad", "gorilla", "mouse", "goose", "croc", "steve", "creeper", "speedster", "kirby", "robot", "turtleninja", "knight", "pirate"].indexOf(id) + 1;
    const srcPath = path.join(OLD, `avatar-${String(num).padStart(2, "0")}-${id}.png`);
    const dstPath = path.join(OUT, `avatar/${id}.png`);
    if (existsSync(srcPath)) { copyFileSync(srcPath, dstPath); console.log("[재배치]", `avatar/${id}.png`); }
  }

  // 2) 몬스터 신규 생성
  for (const a of ASSETS.filter((x) => x.category === "monster")) {
    const key = a.id;
    const spec = MONSTER_SPECS[key];
    if (spec === undefined) { console.warn("⚠️ 몬스터 템플릿 없음:", key); continue; }
    if (spec === null) continue; // 이미 재배치됨
    const W = a.tiles.w * TILE, H = a.tiles.h * TILE;
    writeFileSync(path.join(OUT, a.file), await spec(W, H));
    console.log("[생성]", a.file);
  }

  // 3) 블록 신규 생성 — 색상은 블록마다 실제 소재/테마에 맞게(전부 갈색으로 뭉치던 버그 수정, 2026-07-16)
  const BLOCK_THEME = {
    brick: { hue: 30, lightBand: [35, 48], pattern: "brick" },              // 나무/벽돌
    "question-block": { hue: 48, lightBand: [55, 68], pattern: "plain" },   // 금색 — 물음표블록 클래식
    "ice-block": { hue: 195, lightBand: [55, 68], pattern: "plain" },       // 얼음 청록
    "breakable-block": { hue: 22, lightBand: [30, 42], pattern: "brick" },  // 부서지는 돌/나무(brick보다 어둡게)
    "falling-platform": { hue: 30, lightBand: [40, 52], pattern: "plain" }, // 나무 발판
    "moving-platform": { hue: 210, lightBand: [40, 50], pattern: "metal" }, // 금속 발판(파랑기)
    "pendulum-hazard": { hue: 0, lightBand: [30, 40], pattern: "plain" },   // 위험물 — 진빨강
    "spin-fireball": { hue: 20, lightBand: [45, 55], pattern: "plain" },    // 불 — 주황
    "charge-block": { hue: null, lightBand: [40, 50], pattern: "metal" },  // 돌(퉁퉁이류) — 회색
    spring: { hue: 0, lightBand: [45, 55], pattern: "plain" },             // 빨강(지그재그 아이콘과 세트)
    "updraft-fan": { hue: 200, lightBand: [60, 72], pattern: "plain" },    // 하늘색 — 상승기류
    "conveyor-belt": { hue: null, lightBand: [35, 45], pattern: "metal" }, // 산업용 회색
    "dash-panel": { hue: 25, lightBand: [50, 60], pattern: "plain" },      // 선명한 주황 — 에너지
    "cannon-straight": { hue: null, lightBand: [20, 30], pattern: "metal" }, // 짙은 금속회색
    "cannon-homing": { hue: null, lightBand: [20, 30], pattern: "metal" },
    "switch-block-on": { hue: 270, lightBand: [45, 55], pattern: "plain" }, // 보라
    "switch-block-off": { hue: 270, lightBand: [20, 30], pattern: "plain" }, // 같은 보라, 훨씬 어둡게(꺼짐)
    "blink-block": { hue: 170, lightBand: [50, 62], pattern: "plain" },    // 청록(스위치·물음표와 구분)
    "hidden-block": { hue: null, lightBand: [55, 65], pattern: "plain" },  // 중립 회색(위장 개념)
    "spike-row": { hue: null, lightBand: [30, 40], pattern: "metal" },     // 금속/돌 가시
    icicle: { hue: 200, lightBand: [65, 78], pattern: "plain" },           // 옅은 얼음색
    "corner-wall": { hue: null, lightBand: [45, 55], pattern: "metal" },   // 돌벽
    "ride-start": { hue: 140, lightBand: [40, 50], pattern: "plain" },     // 초록 — 시작점 표시
    "ride-oneway": { hue: 210, lightBand: [50, 60], pattern: "plain" },    // 파랑 — ride-start와 구분
    "breakblocks-block": { hue: null, lightBand: [15, 25], pattern: "metal" }, // 짙은 회색 — 파괴용
  };
  for (const a of ASSETS.filter((x) => x.category === "block")) {
    if (a.id.startsWith("slope-") && existsSync(path.join(OUT, a.file))) continue; // 이미 재배치됨(2종)
    const W = a.tiles.w * TILE, H = a.tiles.h * TILE;
    if (a.id.startsWith("slope-")) {
      const dir = a.id.replace("slope-", ""); // "slope-floor-desc" → "floor-desc" (slopeCorners가 기대하는 형식)
      const isFloor = dir.startsWith("floor");
      writeFileSync(path.join(OUT, a.file), await genSlope(dir, W, H, isFloor ? 30 : 210, isFloor ? 120 : 210));
      console.log("[생성]", a.file);
      continue;
    }
    const iconFn = BLOCK_ICONS[a.id];
    if (iconFn === undefined) { console.warn("⚠️ 블록 템플릿 없음:", a.id); continue; }
    const theme = BLOCK_THEME[a.id] ?? { hue: 30, lightBand: [35, 50], pattern: "plain" }; // 안전망(전부 커버됨)
    const fill = theme.hue === null ? pickGray(theme.lightBand) : pick(theme.hue, theme.lightBand);
    const dark = pickGray([15, 25]);
    writeFileSync(path.join(OUT, a.file), await genBlockIcon(W, H, { fill, dark, pattern: theme.pattern, iconFn }));
    console.log("[생성]", a.file);
  }

  // 4) 배경 신규 생성
  const BG_THEME = {
    "bg-grassland": { theme: "grassland", sky: pick(190, [70, 82]), ground: pick(110, [40, 50]), silhouette: pick(130, [30, 40]) },
    "bg-cave": { theme: "cave", sky: pickGray([12, 20]), ground: pickGray([20, 30]), silhouette: pickGray([8, 15]) },
    "bg-castle": { theme: "castle", sky: pick(260, [30, 40]), ground: pickGray([25, 35]), silhouette: pickGray([12, 20]) },
    "bg-night-sky": { theme: "night-sky", sky: pick(240, [15, 25]), ground: pickGray([10, 18]), silhouette: pick(48, [80, 90]) },
    "bg-underwater": { theme: "underwater", sky: pick(200, [45, 55]), ground: pick(200, [25, 35]), silhouette: pick(30, [50, 60]) },
  };
  for (const a of ASSETS.filter((x) => x.category === "background")) {
    const theme = BG_THEME[a.id];
    const W = a.tiles.w * TILE, H = a.tiles.h * TILE;
    writeFileSync(path.join(OUT, a.file), await genBackground(W, H, theme));
    console.log("[생성]", a.file);
  }

  // 5) 아이템 신규 생성
  for (const a of ASSETS.filter((x) => x.category === "item")) {
    const W = a.tiles.w * TILE, H = a.tiles.h * TILE;
    const png = a.id === "item-giant-mushroom" ? await genGiantMushroom(W, H) : await genSpeedBoost(W, H);
    writeFileSync(path.join(OUT, a.file), png);
    console.log("[생성]", a.file);
  }

  console.log("\n완료.");
}

main().catch((e) => { console.error(e); process.exit(1); });
