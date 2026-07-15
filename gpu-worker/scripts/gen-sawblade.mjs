// 테스트용 톱니바퀴(sawblade) 이미지 생성 — 투명배경 PNG (sourceType=drawn 검증 통과용).
// 회전 대칭 톱니 실루엣 + 중앙 볼트 구멍. 저작권 이슈 없는 순수 합성 이미지.
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SIZE = 512;
const CX = SIZE / 2;
const CY = SIZE / 2;
const TEETH = 12;
const OUTER_R = 220;
const INNER_R = 165;
const HUB_R = 70;
const HOLE_R = 22;

function toothedPolygonPoints() {
  const pts = [];
  const step = (Math.PI * 2) / TEETH;
  for (let i = 0; i < TEETH; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.35;
    const a2 = a0 + step * 0.5;
    const a3 = a0 + step * 0.85;
    pts.push([CX + Math.cos(a0) * INNER_R, CY + Math.sin(a0) * INNER_R]);
    pts.push([CX + Math.cos(a1) * OUTER_R, CY + Math.sin(a1) * OUTER_R]);
    pts.push([CX + Math.cos(a2) * OUTER_R, CY + Math.sin(a2) * OUTER_R]);
    pts.push([CX + Math.cos(a3) * INNER_R, CY + Math.sin(a3) * INNER_R]);
  }
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

const svg = `
<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <polygon points="${toothedPolygonPoints()}" fill="#b9c2cc" stroke="#3a3f47" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="${CX}" cy="${CY}" r="${INNER_R - 6}" fill="#8f98a3" stroke="#3a3f47" stroke-width="4"/>
  <circle cx="${CX}" cy="${CY}" r="${HUB_R}" fill="#6b727c" stroke="#3a3f47" stroke-width="4"/>
  <circle cx="${CX}" cy="${CY}" r="${HOLE_R}" fill="#1a1c1f"/>
  ${Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    const x = CX + Math.cos(a) * (HUB_R - 18);
    const y = CY + Math.sin(a) * (HUB_R - 18);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="#3a3f47"/>`;
  }).join("\n  ")}
</svg>`;

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "gpu-worker-test-sawblade.png");
const buf = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(outPath, buf);
console.log("생성됨:", outPath, `${buf.length} bytes`);
