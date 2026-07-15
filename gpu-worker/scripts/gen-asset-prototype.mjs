// 에셋 소스 이미지 프로토타입 — 손그림 느낌(굵은 붓 + 흔들림) + ~120칸 그리드 팔레트.
// 테두리(면 색 표시)는 렌더 계층 몫이라 여기선 절대 안 그림. 순수 실루엣+디테일 채색만.
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, "asset-prototype");
mkdirSync(OUT_DIR, { recursive: true });

const TILE = 64;

// ---------- 팔레트: 색상×명도 그리드(~120칸), 크로마키 4색 인근 제외 ----------
const CHROMA_HUES = [120, 300, 180, 240]; // green/magenta/cyan/blue
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
  for (const h of hues) {
    for (const s of sats) {
      for (const l of lights) {
        const nearChroma = CHROMA_HUES.some(
          (ch) => Math.min(Math.abs(h - ch), 360 - Math.abs(h - ch)) <= 6 && s >= 70 && l >= 40 && l <= 60,
        );
        if (nearChroma) continue;
        grid.push({ h, s, l, hex: hslToHex(h, s, l) });
      }
    }
  }
  const gray = [10, 20, 30, 40, 50, 60, 70, 80, 90].map((l) => ({ h: 0, s: 0, l, hex: hslToHex(0, 0, l) }));
  return { grid, gray };
}
const PALETTE = buildPalette();
console.log(`[palette] 색상칸 ${PALETTE.grid.length} + 회색조 ${PALETTE.gray.length} = ${PALETTE.grid.length + PALETTE.gray.length}칸`);

/**
 * 팔레트에서 특정 색상 계열(hue 근사)·명도대 근처 색을 찾아옴 (완전 랜덤 대신 의도된 색감용).
 * ⚠️ 명도 그리드는 5단계(25/40/55/70/85)뿐이라 좁은 lightBand([42,52] 등)엔 정확히 맞는 칸이
 * 없을 수 있음 — 그 경우 전혀 무관한 fallback(그리드 0번=어두운 빨강)으로 새지 않도록,
 * 같은 색상 계열(hue) 안에서 밴드 중앙에 가장 가까운 명도로 대체한다.
 */
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

// ---------- 손그림 흔들림 도형 엔진 ----------
/** 중심 기준 불규칙 반경의 점들 생성 (블롭·가시공 등 방사형 실루엣 공용) */
function wobblyRadialPoints(cx, cy, baseR, n, jitter, spikeChance, spikeBoost) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * (Math.PI / n) * 0.6; // 각도도 살짝 흔들
    let r = baseR * (1 + (Math.random() - 0.5) * 2 * jitter);
    if (Math.random() < spikeChance) r *= spikeBoost; // 삐죽 돌기
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}
/** 닫힌 점열을 catmull-rom → 3차 베지어로 매끄러운 손떨림 곡선 경로로 변환 */
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
/** 두 점 사이 손떨림 직선(약간 구불거리는 곡선) — 다리·팔·줄기 등 */
function wobblyLinePath(x1, y1, x2, y2, wobble) {
  const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * wobble;
  const my = (y1 + y2) / 2 + (Math.random() - 0.5) * wobble;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
function blobShape(cx, cy, r, opts = {}) {
  const { n = 12, jitter = 0.12, spikeChance = 0, spikeBoost = 1.3 } = opts;
  return smoothClosedPath(wobblyRadialPoints(cx, cy, r, n, jitter, spikeChance, spikeBoost));
}

// ---------- 프로토타입 1: 굼바 (1x1, 64x64) ----------
async function genGoomba() {
  const W = TILE, H = TILE;
  const body = pick(30, [30, 45]); // 갈색
  const bodyDark = pick(30, [15, 25]);
  const foot = pick(30, [15, 25]);
  const eyeWhite = pickGray([85, 95]);
  const eyeDark = pickGray([5, 15]);
  const brow = pickGray([5, 15]);

  const cx = W / 2, cy = H * 0.42;
  const bodyPath = blobShape(cx, cy, W * 0.36, { n: 11, jitter: 0.14 });
  const strokeW = Math.max(3, Math.round(W * 0.06));

  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <!-- 발 2개 (뭉툭, 흔들린 타원) -->
  <path d="${blobShape(cx - W * 0.2, H * 0.82, W * 0.16, { n: 8, jitter: 0.18 })}" fill="${foot}"/>
  <path d="${blobShape(cx + W * 0.2, H * 0.82, W * 0.16, { n: 8, jitter: 0.18 })}" fill="${foot}"/>
  <!-- 몸통 -->
  <path d="${bodyPath}" fill="${body}"/>
  <!-- 아랫배 음영 (흔들린 반원형 블롭) -->
  <path d="${blobShape(cx, cy + H * 0.22, W * 0.24, { n: 9, jitter: 0.16 })}" fill="${bodyDark}" opacity="0.55"/>
  <!-- 눈 -->
  <path d="${blobShape(cx - W * 0.13, cy - H * 0.02, W * 0.09, { n: 7, jitter: 0.15 })}" fill="${eyeWhite}"/>
  <path d="${blobShape(cx + W * 0.13, cy - H * 0.02, W * 0.09, { n: 7, jitter: 0.15 })}" fill="${eyeWhite}"/>
  <path d="${blobShape(cx - W * 0.12, cy + H * 0.01, W * 0.045, { n: 6, jitter: 0.2 })}" fill="${eyeDark}"/>
  <path d="${blobShape(cx + W * 0.14, cy + H * 0.01, W * 0.045, { n: 6, jitter: 0.2 })}" fill="${eyeDark}"/>
  <!-- 성난 눈썹 (굵은 손떨림 선) -->
  <path d="${wobblyLinePath(cx - W * 0.22, cy - H * 0.16, cx - W * 0.04, cy - H * 0.1, 5)}" stroke="${brow}" stroke-width="${strokeW}" stroke-linecap="round" fill="none"/>
  <path d="${wobblyLinePath(cx + W * 0.22, cy - H * 0.16, cx + W * 0.04, cy - H * 0.1, 5)}" stroke="${brow}" stroke-width="${strokeW}" stroke-linecap="round" fill="none"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ---------- 프로토타입 2: 뻐끔플라워 (1x2, 64x128) ----------
async function genPiranha() {
  const W = TILE, H = TILE * 2;
  const pipe = pick(140, [38, 48]); // 파이프 몸통(중간톤 초록)
  const pipeLipColor = pick(140, [55, 65]); // 림은 더 밝게 — 파이프 몸통과 구분
  const pipeDark = pick(140, [18, 28]); // 파이프 음영(가장 어둡게)
  const petal = pick(0, [42, 52]); // 꽃잎(빨강)
  const petalDark = pick(0, [22, 30]);
  const spot = pickGray([88, 96]);
  const mouth = pickGray([8, 18]);
  const stem = pick(140, [20, 28]); // 줄기는 파이프보다 확실히 어둡게

  // 세로 배치 재조정: 파이프를 크고 뚜렷하게(하단 45%), 머리는 축소, 줄기는 짧고 굵게.
  const pipeTop = H * 0.58;
  const headCy = H * 0.24;
  const headR = W * 0.3; // 이전 0.4 → 축소, 캔버스 가장자리 안 닿게
  const strokeW = Math.max(4, Math.round(W * 0.1));

  // 파이프 몸통 — 폭 넓게(캔버스의 80%), 살짝만 흔들림
  const pipeBody = `M ${(W * 0.1 + (Math.random() - 0.5) * 3).toFixed(1)} ${pipeTop.toFixed(1)} ` +
    `L ${(W * 0.9 + (Math.random() - 0.5) * 3).toFixed(1)} ${(pipeTop + (Math.random() - 0.5) * 3).toFixed(1)} ` +
    `L ${(W * 0.87 + (Math.random() - 0.5) * 3).toFixed(1)} ${H} L ${(W * 0.13 + (Math.random() - 0.5) * 3).toFixed(1)} ${H} Z`;
  // 파이프 림(상단 테두리 밝은 띠) — 몸통보다 넓게 튀어나온 타원형 블롭
  const pipeLip = blobShape(W * 0.5, pipeTop, W * 0.46, { n: 10, jitter: 0.08 });

  // 꽃잎(방사형 뾰족 블롭)
  const petals = blobShape(W * 0.5, headCy, headR, { n: 9, jitter: 0.16, spikeChance: 0.45, spikeBoost: 1.3 });

  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <!-- 파이프(먼저 그려서 배경 역할) -->
  <path d="${pipeBody}" fill="${pipe}"/>
  <path d="${pipeLip}" fill="${pipeLipColor}"/>
  <path d="${blobShape(W * 0.5, H * 0.85, W * 0.28, { n: 8, jitter: 0.12 })}" fill="${pipeDark}" opacity="0.4"/>
  <!-- 줄기(짧고 굵게, 파이프 림 중앙에서 머리까지) -->
  <path d="${wobblyLinePath(W * 0.5, headCy + headR * 0.85, W * 0.5, pipeTop - H * 0.02, 5)}" stroke="${stem}" stroke-width="${strokeW * 1.3}" stroke-linecap="round" fill="none"/>
  <!-- 머리(꽃잎) -->
  <path d="${petals}" fill="${petal}"/>
  <path d="${blobShape(W * 0.5, headCy, headR * 0.68, { n: 8, jitter: 0.14 })}" fill="${petalDark}" opacity="0.4"/>
  <!-- 반점 -->
  <path d="${blobShape(W * 0.37, headCy - headR * 0.28, W * 0.045, { n: 6, jitter: 0.2 })}" fill="${spot}"/>
  <path d="${blobShape(W * 0.63, headCy + headR * 0.12, W * 0.04, { n: 6, jitter: 0.2 })}" fill="${spot}"/>
  <path d="${blobShape(W * 0.47, headCy + headR * 0.4, W * 0.035, { n: 6, jitter: 0.2 })}" fill="${spot}"/>
  <!-- 입(굵은 손떨림 선) -->
  <path d="${wobblyLinePath(W * 0.33, headCy + headR * 0.05, W * 0.67, headCy + headR * 0.05, 7)}" stroke="${mouth}" stroke-width="${strokeW}" stroke-linecap="round" fill="none"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ---------- 프로토타입 3: 체인추피 (2x2, 128x128) ----------
async function genChainChomp() {
  const W = TILE * 2, H = TILE * 2;
  const body = pickGray([15, 25]);
  const bodyLight = pickGray([30, 40]);
  const eyeWhite = pickGray([90, 97]);
  const eyeDark = pickGray([5, 12]);
  const tooth = pickGray([90, 97]);
  const chain = pickGray([45, 55]);

  const cx = W * 0.52, cy = H * 0.48;
  const spikyBody = blobShape(cx, cy, W * 0.38, { n: 14, jitter: 0.1, spikeChance: 0.35, spikeBoost: 1.25 });
  const strokeW = Math.max(5, Math.round(W * 0.045));

  // 사슬 스텁 (좌하단, anchor 표시용 작은 원 3개 손떨림)
  const chainLinks = [0, 1, 2].map((i) => {
    const lx = W * 0.12 - i * W * 0.03, ly = H * 0.88 + i * H * 0.03;
    return `<path d="${blobShape(lx, ly, W * 0.05, { n: 7, jitter: 0.15 })}" fill="none" stroke="${chain}" stroke-width="${Math.max(2, strokeW * 0.5)}"/>`;
  }).join("\n  ");

  // 이빨 (아래쪽 방사형 삼각 느낌 — 작은 스파이크 블롭 여러 개)
  const teeth = Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI * 0.15 + (i / 5) * Math.PI * 0.7;
    const r = W * 0.34;
    const tx = cx + Math.cos(a) * r, ty = cy + Math.sin(a) * r * 0.9 + H * 0.06;
    return `<path d="${blobShape(tx, ty, W * 0.035, { n: 6, jitter: 0.2, spikeChance: 0.3, spikeBoost: 1.4 })}" fill="${tooth}"/>`;
  }).join("\n  ");

  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  ${chainLinks}
  <!-- 몸통(가시투성이 흔들린 공) -->
  <path d="${spikyBody}" fill="${body}"/>
  <path d="${blobShape(cx - W * 0.1, cy - H * 0.12, W * 0.14, { n: 9, jitter: 0.15 })}" fill="${bodyLight}" opacity="0.4"/>
  <!-- 이빨 -->
  ${teeth}
  <!-- 눈 -->
  <path d="${blobShape(cx - W * 0.1, cy - H * 0.05, W * 0.075, { n: 7, jitter: 0.15 })}" fill="${eyeWhite}"/>
  <path d="${blobShape(cx + W * 0.11, cy - H * 0.05, W * 0.075, { n: 7, jitter: 0.15 })}" fill="${eyeWhite}"/>
  <path d="${blobShape(cx - W * 0.09, cy - H * 0.04, W * 0.035, { n: 6, jitter: 0.2 })}" fill="${eyeDark}"/>
  <path d="${blobShape(cx + W * 0.12, cy - H * 0.04, W * 0.035, { n: 6, jitter: 0.2 })}" fill="${eyeDark}"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ---------- 손 아이콘 (carry 표시용 UI 오버레이 — 게임플레이 에셋 아님, 유일하게 테두리 허용) ----------
/** 회전된 손떨림 타원 (손가락·엄지용) — 중심(cx,cy), 반경(rx,ry), 회전각(rad) */
function wobblyOval(cx, cy, rx, ry, rot, n = 9, jitter = 0.12) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const j = 1 + (Math.random() - 0.5) * 2 * jitter;
    const ex = Math.cos(a) * rx * j, ey = Math.sin(a) * ry * j;
    const rx2 = ex * Math.cos(rot) - ey * Math.sin(rot);
    const ry2 = ex * Math.sin(rot) + ey * Math.cos(rot);
    pts.push([cx + rx2, cy + ry2]);
  }
  return smoothClosedPath(pts);
}
async function genHandIcon() {
  const W = TILE, H = TILE;
  const glove = pickGray([25, 38]); // 장갑 몸통 — 회색/어두운 계열
  const shade = pickGray([10, 18]); // 음영은 더 어둡게
  const outline = "#ffffff"; // 테두리 — 완전 흰색 고정(그리드 팔레트 아님)
  const outlineW = Math.max(2, Math.round(W * 0.045));

  const palmCx = W * 0.5, palmCy = H * 0.66;
  const palmR = W * 0.19;
  const palm = blobShape(palmCx, palmCy, palmR, { n: 10, jitter: 0.12 });

  // 손가락 4개 — 펼쳐 잡는 포즈로 부채꼴 각도 분산(위쪽 방향 중심). base가 palmR 안쪽까지 들어가
  // 팔모양과 이어붙되, 길이(ry)를 충분히 줘서 끝이 팔모양 밖으로 뚜렷하게 삐져나오게.
  const fingerAngles = [-105, -68, -32, 2].map((d) => (d * Math.PI) / 180);
  const fingers = fingerAngles.map((a) => {
    const rx = W * 0.075, ry = W * 0.2;
    const dist = palmR * 0.55; // base는 팔모양 안쪽에 묻혀 이어짐
    const fx = palmCx + Math.cos(a) * dist, fy = palmCy + Math.sin(a) * dist;
    return wobblyOval(fx, fy, rx, ry, a + Math.PI / 2, 8, 0.13);
  });
  // 엄지 — 굵고 짧게, 옆으로 뻗어 잡는 느낌
  const thumbA = (155 * Math.PI) / 180;
  const thumbDist = palmR * 0.5;
  const thumbCx = palmCx + Math.cos(thumbA) * thumbDist, thumbCy = palmCy + Math.sin(thumbA) * thumbDist;
  const thumb = wobblyOval(thumbCx, thumbCy, W * 0.1, W * 0.15, thumbA + Math.PI / 2 - 0.4, 8, 0.13);

  const partsSvg = [...fingers, thumb]
    .map((d) => `<path d="${d}" fill="${glove}" stroke="${outline}" stroke-width="${outlineW}"/>`)
    .join("\n  ");

  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  ${partsSvg}
  <path d="${palm}" fill="${glove}" stroke="${outline}" stroke-width="${outlineW}"/>
  <!-- 손바닥 음영(잡는 주름) -->
  <path d="${wobblyLinePath(palmCx - W * 0.12, palmCy + H * 0.02, palmCx + W * 0.1, palmCy - H * 0.06, 4)}" stroke="${shade}" stroke-width="${Math.max(2, outlineW * 0.8)}" stroke-linecap="round" fill="none" opacity="0.7"/>
  <path d="${blobShape(palmCx + W * 0.02, palmCy + H * 0.05, W * 0.09, { n: 7, jitter: 0.15 })}" fill="${shade}" opacity="0.35"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ---------- 아바타 기본 테스트용 마리오풍 캐릭터 (1x2 타일 캔버스=64x128, 키 1.5타일=96px) ----------
// 재설계: 셔츠(빨강, 넓게) → 멜빵판(파랑, 그 위에 좁게 얹음) → 어깨끈 → 팔·다리(엇갈려 3/4뷰).
// 머리 비율을 마스코트답게 키우고, 모자는 크게, 콧수염은 갈색으로 눈에 띄게.
async function genMarioAvatar() {
  const W = TILE, H = TILE * 2;
  const shirt = pick(0, [45, 55]); // 빨강 셔츠(넓은 베이스, 소매도 이 색)
  const overalls = pick(220, [32, 42]); // 파랑 멜빵판+끈+바지
  const skin = pick(30, [68, 80]);
  const mustache = pick(25, [18, 26]); // 갈색(회색 아님 — 대비용)
  const shoe = pickGray([15, 24]);
  const buttonC = pick(48, [58, 70]); // 노랑 단추
  const eyeDark = pickGray([8, 15]);

  const topY = H * 0.125; // 16px 여백
  const headR = W * 0.24; // 마스코트 비율(머리 크게)
  const faceDX = headR * 0.18; // 얼굴을 진행방향(오른쪽)으로 치우침
  const headCx = W * 0.5 + faceDX * 0.4;
  const headCy = topY + headR * 1.05;
  const neckY = headCy + headR * 0.95;
  const torsoCy = neckY + H * 0.11;
  const torsoR = W * 0.27;
  const bibR = torsoR * 0.7;
  const bibCy = torsoCy + torsoR * 0.18;
  const hipY = torsoCy + torsoR * 0.85;
  const feetY = topY + H * 0.75; // 키 1.5타일 지점

  const cx = W * 0.5;
  const shoulderY = torsoCy - torsoR * 0.35;
  // 완전 측면(오른쪽 바라봄) — 몸 전체를 진행방향(오른쪽)으로 쏠리게, 뒷팔/뒷다리는 몸통 뒤에
  // 가려지도록 몸 중심 가까이(거의 안 보이게), 앞팔/앞다리만 뚜렷이 뻗어 걷는 실루엣.
  const handL = [cx - W * 0.02, shoulderY + H * 0.05]; // 뒷팔 — 몸통에 거의 가려짐
  const handR = [cx + W * 0.42, shoulderY + H * 0.14]; // 앞팔 — 진행방향으로 크게 뻗음
  const footL = [cx + W * 0.02, feetY - H * 0.02]; // 뒷다리 — 몸통 아래 살짝
  const footR = [cx + W * 0.3, feetY]; // 앞다리 — 진행방향으로 크게 뻗음

  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <!-- 다리(멜빵바지 색) -->
  <path d="${wobblyLinePath(cx - W * 0.06, hipY, footL[0], footL[1], 4)}" stroke="${overalls}" stroke-width="${W * 0.15}" stroke-linecap="round" fill="none"/>
  <path d="${wobblyLinePath(cx + W * 0.08, hipY, footR[0], footR[1], 4)}" stroke="${overalls}" stroke-width="${W * 0.15}" stroke-linecap="round" fill="none"/>
  <!-- 신발 -->
  <path d="${blobShape(footL[0], footL[1], W * 0.1, { n: 7, jitter: 0.16 })}" fill="${shoe}"/>
  <path d="${blobShape(footR[0], footR[1], W * 0.1, { n: 7, jitter: 0.16 })}" fill="${shoe}"/>
  <!-- 팔(셔츠색 소매) -->
  <path d="${wobblyLinePath(cx - torsoR * 0.6, shoulderY, handL[0], handL[1], 6)}" stroke="${shirt}" stroke-width="${W * 0.13}" stroke-linecap="round" fill="none"/>
  <path d="${wobblyLinePath(cx + torsoR * 0.6, shoulderY, handR[0], handR[1], 6)}" stroke="${shirt}" stroke-width="${W * 0.13}" stroke-linecap="round" fill="none"/>
  <!-- 손 -->
  <path d="${blobShape(handL[0], handL[1], W * 0.09, { n: 7, jitter: 0.16 })}" fill="${skin}"/>
  <path d="${blobShape(handR[0], handR[1], W * 0.09, { n: 7, jitter: 0.16 })}" fill="${skin}"/>
  <!-- 셔츠(넓은 베이스, 어깨~허리) -->
  <path d="${blobShape(cx, torsoCy, torsoR, { n: 9, jitter: 0.12 })}" fill="${shirt}"/>
  <!-- 멜빵판(셔츠보다 좁게 얹어서 셔츠가 옆으로 살짝 보이게) -->
  <path d="${blobShape(cx, bibCy, bibR, { n: 8, jitter: 0.13 })}" fill="${overalls}"/>
  <!-- 멜빵끈(두껍게, 목 옆까지 확실히) -->
  <path d="${wobblyLinePath(cx - bibR * 0.55, bibCy - bibR * 0.5, cx - headR * 0.5, neckY - headR * 0.1, 3)}" stroke="${overalls}" stroke-width="${strokeW(W) * 1.3}" stroke-linecap="round" fill="none"/>
  <path d="${wobblyLinePath(cx + bibR * 0.55, bibCy - bibR * 0.5, cx + headR * 0.5, neckY - headR * 0.1, 3)}" stroke="${overalls}" stroke-width="${strokeW(W) * 1.3}" stroke-linecap="round" fill="none"/>
  <!-- 단추 2개 -->
  <path d="${blobShape(cx - bibR * 0.28, bibCy + bibR * 0.15, W * 0.045, { n: 6, jitter: 0.2 })}" fill="${buttonC}"/>
  <path d="${blobShape(cx + bibR * 0.28, bibCy + bibR * 0.15, W * 0.045, { n: 6, jitter: 0.2 })}" fill="${buttonC}"/>
  <!-- 얼굴 — 완전 측면(계란형, 뒤통수는 둥글고 앞쪽은 코가 튀어나오는 옆모습) -->
  <path d="${wobblyOval(headCx - headR * 0.08, headCy, headR * 0.92, headR, 0, 10, 0.08)}" fill="${skin}"/>
  <!-- 코(오른쪽으로 튀어나온 돌기 — 옆모습 핵심 단서) -->
  <path d="${blobShape(headCx + headR * 0.85, headCy + headR * 0.08, headR * 0.24, { n: 7, jitter: 0.14 })}" fill="${skin}"/>
  <!-- 귀(뒤통수 쪽) -->
  <path d="${blobShape(headCx - headR * 0.75, headCy + headR * 0.15, headR * 0.2, { n: 6, jitter: 0.15 })}" fill="${skin}"/>
  <!-- 눈 1개(옆모습이라 안쪽 눈은 안 보임) -->
  <path d="${blobShape(headCx + headR * 0.32, headCy - headR * 0.12, headR * 0.13, { n: 6, jitter: 0.15 })}" fill="${eyeDark}"/>
  <!-- 콧수염(코 아래로, 진행방향 앞쪽까지 뻗음) -->
  <path d="${blobShape(headCx + headR * 0.72, headCy + headR * 0.32, headR * 0.32, { n: 8, jitter: 0.15, spikeChance: 0.2, spikeBoost: 1.15 })}" fill="${mustache}"/>
  <!-- 모자(뒤통수~정수리를 덮고, 챙은 진행방향 앞으로 튀어나옴 — 옆모습 모자 실루엣) -->
  <path d="${wobblyOval(headCx - headR * 0.15, headCy - headR * 0.55, headR * 0.85, headR * 0.65, 0, 9, 0.08)}" fill="${shirt}"/>
  <path d="${wobblyOval(headCx + headR * 0.68, headCy - headR * 0.28, headR * 0.42, headR * 0.18, 0.05, 7, 0.1)}" fill="${shirt}"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
function strokeW(W) { return Math.max(3, Math.round(W * 0.06)); }

// ---------- 공용 휴머노이드 골격 (아바타 로스터 16종 중 사람형 캐릭터가 재사용) ----------
// genMarioAvatar와 같은 비율 공식을 좌표만 뽑아 재사용 — 캐릭터별로 색·머리장식만 바꿔 얹는다.
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
/** 팔다리+몸통(+선택 멜빵판)+눈 — 머리 장식·얼굴 디테일은 캐릭터별로 이어 붙임 */
function humanoidBodySvg(g, { shirt, pants, skin, shoe, bib, button, eye = "#1a1c1f", withBib = true }) {
  const { W, H, headR, headCx, headCy, torsoCy, torsoR, bibR, bibCy, hipY, cx, shoulderY, handL, handR, footL, footR } = g;
  return `
  <path d="${wobblyLinePath(cx - W * 0.06, hipY, footL[0], footL[1], 4)}" stroke="${pants}" stroke-width="${W * 0.15}" stroke-linecap="round" fill="none"/>
  <path d="${wobblyLinePath(cx + W * 0.08, hipY, footR[0], footR[1], 4)}" stroke="${pants}" stroke-width="${W * 0.15}" stroke-linecap="round" fill="none"/>
  <path d="${blobShape(footL[0], footL[1], W * 0.1, { n: 7, jitter: 0.16 })}" fill="${shoe}"/>
  <path d="${blobShape(footR[0], footR[1], W * 0.1, { n: 7, jitter: 0.16 })}" fill="${shoe}"/>
  <path d="${wobblyLinePath(cx - torsoR * 0.6, shoulderY, handL[0], handL[1], 6)}" stroke="${shirt}" stroke-width="${W * 0.13}" stroke-linecap="round" fill="none"/>
  <path d="${wobblyLinePath(cx + torsoR * 0.6, shoulderY, handR[0], handR[1], 6)}" stroke="${shirt}" stroke-width="${W * 0.13}" stroke-linecap="round" fill="none"/>
  <path d="${blobShape(handL[0], handL[1], W * 0.09, { n: 7, jitter: 0.16 })}" fill="${skin}"/>
  <path d="${blobShape(handR[0], handR[1], W * 0.09, { n: 7, jitter: 0.16 })}" fill="${skin}"/>
  <path d="${blobShape(cx, torsoCy, torsoR, { n: 9, jitter: 0.12 })}" fill="${shirt}"/>
  ${withBib ? `<path d="${blobShape(cx, bibCy, bibR, { n: 8, jitter: 0.13 })}" fill="${bib}"/>
  <path d="${wobblyLinePath(cx - bibR * 0.55, bibCy - bibR * 0.5, cx - headR * 0.5, g.neckY - headR * 0.1, 3)}" stroke="${bib}" stroke-width="${strokeW(W) * 1.3}" stroke-linecap="round" fill="none"/>
  <path d="${wobblyLinePath(cx + bibR * 0.55, bibCy - bibR * 0.5, cx + headR * 0.5, g.neckY - headR * 0.1, 3)}" stroke="${bib}" stroke-width="${strokeW(W) * 1.3}" stroke-linecap="round" fill="none"/>
  <path d="${blobShape(cx - bibR * 0.28, bibCy + bibR * 0.15, W * 0.045, { n: 6, jitter: 0.2 })}" fill="${button}"/>
  <path d="${blobShape(cx + bibR * 0.28, bibCy + bibR * 0.15, W * 0.045, { n: 6, jitter: 0.2 })}" fill="${button}"/>` : ""}
  <path d="${blobShape(headCx, headCy, headR, { n: 10, jitter: 0.1 })}" fill="${skin}"/>
  <path d="${blobShape(headCx + headR * 0.06, headCy - headR * 0.1, headR * 0.14, { n: 6, jitter: 0.15 })}" fill="${eye}"/>
  <path d="${blobShape(headCx + headR * 0.4, headCy - headR * 0.06, headR * 0.12, { n: 6, jitter: 0.15 })}" fill="${eye}"/>`;
}
async function toPng(svgInner, W, H) {
  return sharp(Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${svgInner}</svg>`)).png().toBuffer();
}

// ---------- 아바타 로스터 (마리오 제외 15종) ----------
async function genLuigiAvatar() {
  const W = TILE, H = TILE * 2;
  const g = humanoidGeom(W, H);
  const shirt = pick(140, [40, 50]), pants = pick(280, [30, 40]), skin = pick(30, [68, 80]);
  const mustache = pick(25, [16, 24]), shoe = pickGray([15, 24]), button = pick(48, [58, 70]);
  const body = humanoidBodySvg(g, { shirt, pants, skin, shoe, bib: pants, button });
  const extra = `
  <path d="${blobShape(g.headCx + g.headR * 0.14, g.headCy + g.headR * 0.4, g.headR * 0.3, { n: 8, jitter: 0.16, spikeChance: 0.25, spikeBoost: 1.2 })}" fill="${mustache}"/>
  <path d="${blobShape(g.headCx, g.headCy - g.headR * 0.85, g.headR * 0.85, { n: 9, jitter: 0.1 })}" fill="${shirt}"/>
  <path d="${wobblyOval(g.headCx + g.headR * 0.78, g.headCy - g.headR * 0.42, g.headR * 0.48, g.headR * 0.22, 0.15, 7, 0.12)}" fill="${shirt}"/>`;
  return toPng(body + extra, W, H);
}
async function genPrincessAvatar() {
  const W = TILE, H = TILE * 2;
  const g = humanoidGeom(W, H, W * 0.23);
  const dress = pick(330, [55, 68]), skin = pick(30, [72, 82]);
  const hair = pick(48, [55, 68]), crown = pick(48, [65, 75]);
  // 다리 없이 드레스가 발끝까지 — 팔·머리만 공용 골격 재사용
  const body = `
  <path d="${blobShape(g.cx, (g.hipY + g.feetY) / 2, W * 0.34, { n: 10, jitter: 0.1 })}" fill="${dress}"/>
  <path d="${wobblyLinePath(g.cx - W * 0.24, g.shoulderY, g.handL[0], g.handL[1], 6)}" stroke="${dress}" stroke-width="${W * 0.12}" stroke-linecap="round" fill="none"/>
  <path d="${wobblyLinePath(g.cx + W * 0.24, g.shoulderY, g.handR[0], g.handR[1], 6)}" stroke="${dress}" stroke-width="${W * 0.12}" stroke-linecap="round" fill="none"/>
  <path d="${blobShape(g.handL[0], g.handL[1], W * 0.08, { n: 7, jitter: 0.16 })}" fill="${skin}"/>
  <path d="${blobShape(g.handR[0], g.handR[1], W * 0.08, { n: 7, jitter: 0.16 })}" fill="${skin}"/>
  <path d="${blobShape(g.cx, g.torsoCy, g.torsoR * 0.9, { n: 9, jitter: 0.1 })}" fill="${dress}"/>
  <path d="${blobShape(g.headCx, g.headCy, g.headR, { n: 10, jitter: 0.1 })}" fill="${skin}"/>
  <path d="${blobShape(g.headCx + g.headR * 0.06, g.headCy - g.headR * 0.1, g.headR * 0.13, { n: 6, jitter: 0.15 })}" fill="#1a1c1f"/>
  <path d="${blobShape(g.headCx + g.headR * 0.38, g.headCy - g.headR * 0.06, g.headR * 0.11, { n: 6, jitter: 0.15 })}" fill="#1a1c1f"/>
  <path d="${blobShape(g.headCx - g.headR * 0.5, g.headCy + g.headR * 0.3, g.headR * 0.5, { n: 8, jitter: 0.15 })}" fill="${hair}"/>
  <path d="${blobShape(g.headCx, g.headCy - g.headR * 0.9, g.headR * 0.5, { n: 6, jitter: 0.1, spikeChance: 0.6, spikeBoost: 1.5 })}" fill="${crown}"/>`;
  return toPng(body, W, H);
}
async function genToadAvatar() {
  const W = TILE, H = TILE * 2;
  const g = humanoidGeom(W, H, W * 0.22);
  const vest = pick(0, [45, 55]), pants = pick(48, [50, 60]), skin = pick(30, [72, 82]);
  const shoe = pickGray([15, 24]), button = pick(48, [58, 70]), capBase = pickGray([90, 97]), spot = pick(0, [45, 55]);
  const body = humanoidBodySvg(g, { shirt: vest, pants, skin, shoe, bib: vest, button });
  const extra = `
  <path d="${blobShape(g.headCx, g.headCy - g.headR * 0.35, g.headR * 1.15, { n: 10, jitter: 0.1 })}" fill="${capBase}"/>
  <path d="${blobShape(g.headCx - g.headR * 0.5, g.headCy - g.headR * 0.55, g.headR * 0.32, { n: 7, jitter: 0.18 })}" fill="${spot}"/>
  <path d="${blobShape(g.headCx + g.headR * 0.55, g.headCy - g.headR * 0.65, g.headR * 0.26, { n: 7, jitter: 0.18 })}" fill="${spot}"/>
  <path d="${blobShape(g.headCx + g.headR * 0.1, g.headCy - g.headR * 1.0, g.headR * 0.22, { n: 7, jitter: 0.18 })}" fill="${spot}"/>`;
  return toPng(body + extra, W, H);
}
async function genGorillaAvatar() {
  const W = TILE, H = TILE * 2;
  const g = humanoidGeom(W, H, W * 0.26);
  const fur = pick(28, [28, 38]), skin = pick(30, [55, 65]);
  const tie = pick(0, [45, 55]), shoe = pickGray([15, 24]);
  const body = humanoidBodySvg(g, { shirt: fur, pants: fur, skin: fur, shoe, bib: skin, button: tie, withBib: true });
  const extra = `
  <path d="${blobShape(g.headCx, g.headCy, g.headR, { n: 10, jitter: 0.12 })}" fill="${fur}"/>
  <path d="${blobShape(g.headCx + g.headR * 0.1, g.headCy + g.headR * 0.15, g.headR * 0.55, { n: 8, jitter: 0.14 })}" fill="${skin}"/>
  <path d="${blobShape(g.headCx + g.headR * 0.06, g.headCy - g.headR * 0.05, g.headR * 0.13, { n: 6, jitter: 0.15 })}" fill="#1a1c1f"/>
  <path d="${blobShape(g.headCx + g.headR * 0.4, g.headCy, g.headR * 0.11, { n: 6, jitter: 0.15 })}" fill="#1a1c1f"/>
  <path d="${wobblyLinePath(g.cx, g.neckY, g.cx + W * 0.02, g.bibCy, 3)}" stroke="${tie}" stroke-width="${strokeW(W) * 1.4}" stroke-linecap="round" fill="none"/>`;
  return toPng(body + extra, W, H);
}
async function genSteveAvatar() {
  const W = TILE, H = TILE * 2;
  const g = humanoidGeom(W, H, W * 0.22);
  const shirt = pick(200, [42, 52]), pants = pickGray([25, 35]), skin = pick(30, [68, 78]);
  const hair = pick(25, [15, 22]), shoe = pickGray([15, 24]), button = pickGray([80, 90]);
  const body = humanoidBodySvg(g, { shirt, pants, skin, shoe, bib: pickGray([30, 40]), button, withBib: false });
  const extra = `
  <path d="${blobShape(g.headCx, g.headCy - g.headR * 0.55, g.headR * 0.9, { n: 8, jitter: 0.06 })}" fill="${hair}"/>`;
  return toPng(body + extra, W, H);
}
async function genCreeperAvatar() {
  const W = TILE, H = TILE * 2;
  const g = humanoidGeom(W, H, W * 0.23);
  const green = pick(115, [35, 45]), greenDark = pick(115, [15, 22]);
  const body = humanoidBodySvg(g, { shirt: green, pants: green, skin: green, shoe: greenDark, bib: greenDark, button: greenDark, eye: "#1a1c1f" });
  const extra = `
  <path d="${blobShape(g.headCx - g.headR * 0.35, g.headCy - g.headR * 0.15, g.headR * 0.22, { n: 6, jitter: 0.1 })}" fill="${greenDark}"/>
  <path d="${blobShape(g.headCx + g.headR * 0.25, g.headCy - g.headR * 0.15, g.headR * 0.2, { n: 6, jitter: 0.1 })}" fill="${greenDark}"/>
  <path d="${wobblyLinePath(g.headCx - g.headR * 0.1, g.headCy + g.headR * 0.15, g.headCx + g.headR * 0.1, g.headCy + g.headR * 0.65, 3)}" stroke="${greenDark}" stroke-width="${W * 0.06}" stroke-linecap="round" fill="none"/>`;
  return toPng(body + extra, W, H);
}
async function genSpeedsterAvatar() {
  const W = TILE, H = TILE * 2;
  const g = humanoidGeom(W, H, W * 0.24);
  const blue = pick(215, [40, 50]), skin = pick(30, [72, 82]);
  const shoe = pick(0, [42, 52]), spike = pick(215, [25, 35]);
  const body = humanoidBodySvg(g, { shirt: blue, pants: blue, skin, shoe, bib: pickGray([90, 97]), button: pickGray([90, 97]) });
  const spikes = [-100, -70, -40].map((d) => {
    const a = (d * Math.PI) / 180, r = g.headR * 1.3;
    return `<path d="${blobShape(g.headCx + Math.cos(a) * r * 0.5, g.headCy + Math.sin(a) * r * 0.5, g.headR * 0.4, { n: 6, jitter: 0.15, spikeChance: 0.7, spikeBoost: 1.6 })}" fill="${spike}"/>`;
  }).join("\n");
  return toPng(body + spikes, W, H);
}
async function genKirbyAvatar() {
  const W = TILE, H = TILE * 2;
  const pink = pick(340, [65, 75]), pinkDark = pick(340, [45, 55]);
  const cx = W * 0.5, cy = H * 0.55, r = W * 0.35;
  const body = `
  <path d="${blobShape(cx, cy, r, { n: 11, jitter: 0.1 })}" fill="${pink}"/>
  <path d="${blobShape(cx - r * 0.75, cy + r * 0.7, r * 0.28, { n: 7, jitter: 0.16 })}" fill="${pinkDark}"/>
  <path d="${blobShape(cx + r * 0.75, cy + r * 0.7, r * 0.28, { n: 7, jitter: 0.16 })}" fill="${pinkDark}"/>
  <path d="${blobShape(cx - r * 0.2, cy - r * 0.1, r * 0.13, { n: 6, jitter: 0.15 })}" fill="#1a1c1f"/>
  <path d="${blobShape(cx + r * 0.28, cy - r * 0.05, r * 0.11, { n: 6, jitter: 0.15 })}" fill="#1a1c1f"/>
  <path d="${blobShape(cx + r * 0.05, cy + r * 0.25, r * 0.16, { n: 6, jitter: 0.15 })}" fill="${pinkDark}" opacity="0.5"/>`;
  return toPng(body, W, H);
}
async function genRobotAvatar() {
  const W = TILE, H = TILE * 2;
  const g = humanoidGeom(W, H, W * 0.23);
  const metal = pickGray([55, 68]), metalDark = pickGray([30, 40]);
  const visor = pick(190, [40, 50]);
  const body = humanoidBodySvg(g, { shirt: metal, pants: metalDark, skin: metal, shoe: metalDark, bib: metalDark, button: visor, eye: visor });
  const extra = `
  <path d="${blobShape(g.headCx, g.headCy - g.headR * 0.5, g.headR * 0.55, { n: 8, jitter: 0.08 })}" fill="${metal}"/>`;
  return toPng(body + extra, W, H);
}
async function genTurtleNinjaAvatar() {
  const W = TILE, H = TILE * 2;
  const g = humanoidGeom(W, H, W * 0.22);
  const green = pick(120, [45, 55]), shell = pick(35, [35, 45]);
  const band = pick(200, [45, 55]), shoe = pickGray([15, 24]);
  const body = humanoidBodySvg(g, { shirt: green, pants: green, skin: green, shoe, bib: shell, button: shell });
  const extra = `
  <path d="${blobShape(g.cx - g.torsoR * 0.15, g.torsoCy + g.torsoR * 0.1, g.torsoR * 0.95, { n: 9, jitter: 0.1 })}" fill="${shell}" opacity="0.85"/>
  <path d="${wobblyLinePath(g.headCx - g.headR * 0.9, g.headCy - g.headR * 0.1, g.headCx + g.headR * 0.9, g.headCy - g.headR * 0.1, 3)}" stroke="${band}" stroke-width="${W * 0.07}" stroke-linecap="round" fill="none"/>`;
  return toPng(body + extra, W, H);
}
async function genKnightAvatar() {
  const W = TILE, H = TILE * 2;
  const g = humanoidGeom(W, H, W * 0.22);
  const armor = pickGray([58, 70]), armorDark = pickGray([35, 45]);
  const visor = pickGray([12, 20]);
  const body = humanoidBodySvg(g, { shirt: armor, pants: armorDark, skin: armor, shoe: armorDark, bib: armorDark, button: armorDark, eye: visor });
  const extra = `
  <path d="${blobShape(g.headCx, g.headCy, g.headR * 1.05, { n: 9, jitter: 0.08 })}" fill="${armor}"/>
  <path d="${blobShape(g.headCx + g.headR * 0.15, g.headCy - g.headR * 0.05, g.headR * 0.45, { n: 6, jitter: 0.1 })}" fill="${visor}" opacity="0.9"/>
  <path d="${blobShape(g.headCx, g.headCy - g.headR * 0.95, g.headR * 0.3, { n: 6, jitter: 0.12, spikeChance: 0.4, spikeBoost: 1.5 })}" fill="${armor}"/>`;
  return toPng(body + extra, W, H);
}
async function genPirateAvatar() {
  const W = TILE, H = TILE * 2;
  const g = humanoidGeom(W, H, W * 0.23);
  const shirt = pickGray([20, 30]), pants = pickGray([15, 25]), skin = pick(30, [68, 78]);
  const hat = pickGray([10, 18]), shoe = pickGray([12, 20]), patch = pickGray([8, 15]);
  const body = humanoidBodySvg(g, { shirt, pants, skin, shoe, bib: pickGray([80, 90]), button: pick(48, [58, 68]) });
  const extra = `
  <path d="${blobShape(g.headCx + g.headR * 0.4, g.headCy - g.headR * 0.06, g.headR * 0.16, { n: 6, jitter: 0.15 })}" fill="${patch}"/>
  <path d="${blobShape(g.headCx, g.headCy - g.headR * 0.75, g.headR * 1.05, { n: 3, jitter: 0.08 })}" fill="${hat}"/>`;
  return toPng(body + extra, W, H);
}
async function genMouseAvatar() {
  const W = TILE, H = TILE * 2;
  const gray = pickGray([55, 65]), grayDark = pickGray([30, 40]), skin = pick(340, [65, 75]);
  const cx = W * 0.5, headCy = H * 0.3, headR = W * 0.24, bodyCy = H * 0.62, bodyR = W * 0.22;
  const feetY = H * 0.125 + H * 0.75;
  const body = `
  <path d="${blobShape(cx, bodyCy, bodyR, { n: 9, jitter: 0.12 })}" fill="${gray}"/>
  <path d="${wobblyLinePath(cx - bodyR * 0.5, bodyCy + bodyR * 0.7, cx - W * 0.12, feetY, 4)}" stroke="${gray}" stroke-width="${W * 0.13}" stroke-linecap="round" fill="none"/>
  <path d="${wobblyLinePath(cx + bodyR * 0.6, bodyCy + bodyR * 0.7, cx + W * 0.2, feetY, 4)}" stroke="${gray}" stroke-width="${W * 0.13}" stroke-linecap="round" fill="none"/>
  <path d="${blobShape(cx - W * 0.12, feetY, W * 0.08, { n: 6, jitter: 0.18 })}" fill="${grayDark}"/>
  <path d="${blobShape(cx + W * 0.2, feetY, W * 0.08, { n: 6, jitter: 0.18 })}" fill="${grayDark}"/>
  <path d="${wobblyLinePath(cx - bodyR * 0.8, bodyCy, cx - bodyR * 1.6, bodyCy - bodyR * 0.5, 8)}" stroke="${gray}" stroke-width="${W * 0.05}" stroke-linecap="round" fill="none"/>
  <path d="${blobShape(cx, headCy, headR, { n: 10, jitter: 0.12 })}" fill="${gray}"/>
  <path d="${blobShape(cx - headR * 0.6, headCy - headR * 0.7, headR * 0.35, { n: 8, jitter: 0.14 })}" fill="${gray}"/>
  <path d="${blobShape(cx + headR * 0.55, headCy - headR * 0.75, headR * 0.32, { n: 8, jitter: 0.14 })}" fill="${gray}"/>
  <path d="${blobShape(cx + headR * 0.55, headCy + headR * 0.2, headR * 0.3, { n: 7, jitter: 0.15 })}" fill="${skin}"/>
  <path d="${blobShape(cx + headR * 0.15, headCy - headR * 0.1, headR * 0.13, { n: 6, jitter: 0.15 })}" fill="#1a1c1f"/>
  <path d="${blobShape(cx + headR * 0.5, headCy - headR * 0.02, headR * 0.11, { n: 6, jitter: 0.15 })}" fill="#1a1c1f"/>`;
  return toPng(body, W, H);
}
async function genGooseAvatar() {
  const W = TILE, H = TILE * 2;
  const white = pickGray([90, 97]), beak = pick(35, [55, 65]);
  const cx = W * 0.44, bodyCy = H * 0.66, bodyR = W * 0.27;
  const headR = W * 0.16, headCy = H * 0.2, headCx = cx + W * 0.22;
  const feetY = H * 0.125 + H * 0.75;
  // 목 — 몸통 윗변(neckBase)에서 머리 아래(neckTip)까지 확실히 이어지게(이전 버그: 둘 다 머리 근처 좌표라 목이 사실상 안 그려짐)
  const neckBase = [cx + W * 0.06, bodyCy - bodyR * 0.85];
  const neckTip = [headCx - headR * 0.2, headCy + headR * 0.75];
  const body = `
  <path d="${wobblyLinePath(neckBase[0], neckBase[1], neckTip[0], neckTip[1], W * 0.05)}" stroke="${white}" stroke-width="${W * 0.15}" stroke-linecap="round" fill="none"/>
  <path d="${blobShape(cx, bodyCy, bodyR, { n: 10, jitter: 0.11 })}" fill="${white}"/>
  <path d="${wobblyLinePath(cx - W * 0.08, bodyCy + bodyR * 0.75, cx - W * 0.08, feetY, 4)}" stroke="${beak}" stroke-width="${W * 0.06}" stroke-linecap="round" fill="none"/>
  <path d="${wobblyLinePath(cx + W * 0.1, bodyCy + bodyR * 0.75, cx + W * 0.16, feetY, 4)}" stroke="${beak}" stroke-width="${W * 0.06}" stroke-linecap="round" fill="none"/>
  <path d="${blobShape(headCx, headCy, headR, { n: 8, jitter: 0.13 })}" fill="${white}"/>
  <path d="${blobShape(headCx + headR * 1.05, headCy + headR * 0.1, headR * 0.55, { n: 6, jitter: 0.15, spikeChance: 0.3, spikeBoost: 1.3 })}" fill="${beak}"/>
  <path d="${blobShape(headCx + headR * 0.15, headCy - headR * 0.15, headR * 0.14, { n: 6, jitter: 0.15 })}" fill="#1a1c1f"/>`;
  return toPng(body, W, H);
}
async function genCrocAvatar() {
  const W = TILE, H = TILE * 2;
  const green = pick(105, [35, 45]), greenDark = pick(105, [20, 28]), tooth = pickGray([90, 97]);
  const g = humanoidGeom(W, H, W * 0.2);
  const body = humanoidBodySvg(g, { shirt: green, pants: green, skin: green, shoe: greenDark, bib: greenDark, button: greenDark });
  const snoutCy = g.headCy + g.headR * 0.15;
  const extra = `
  <path d="${blobShape(g.headCx + g.headR * 0.95, snoutCy, g.headR * 0.5, { n: 8, jitter: 0.16, spikeChance: 0.2, spikeBoost: 1.2 })}" fill="${green}"/>
  <path d="${blobShape(g.headCx + g.headR * 1.35, snoutCy + g.headR * 0.15, g.headR * 0.1, { n: 5, jitter: 0.2 })}" fill="${tooth}"/>
  <path d="${blobShape(g.headCx - g.headR * 0.3, g.headCy - g.headR * 0.6, g.headR * 0.22, { n: 6, jitter: 0.15 })}" fill="${greenDark}"/>
  <path d="${blobShape(g.headCx + g.headR * 0.2, g.headCy - g.headR * 0.65, g.headR * 0.2, { n: 6, jitter: 0.15 })}" fill="${greenDark}"/>`;
  return toPng(body + extra, W, H);
}

// ---------- 프로토타입 4: 경사 블록 — shared/physics/terrain.ts 실제 충돌 형태(dir=1 오른쪽 오름)와
// 일치하는 직각삼각형. 사선(지면/천장 표면)만 손떨림, 타일 경계에 붙는 직각 두 변은 깔끔하게 유지.
//   floor-asc(◢): 좌하-우하-우상 / floor-desc(◣): 좌하-우하-좌상
//   ceil-desc(◥): 좌상-우상-우하 / ceil-asc(◤): 좌상-우상-좌하
function slopeCorners(dir, W, H) {
  const BL = [0, H], BR = [W, H], TL = [0, 0], TR = [W, 0];
  switch (dir) {
    case "floor-asc": return { corners: [BL, BR, TR], hypotenuse: [BL, TR] }; // 사선: 좌하→우상
    case "floor-desc": return { corners: [BL, BR, TL], hypotenuse: [BR, TL] }; // 사선: 우하→좌상
    case "ceil-desc": return { corners: [TL, TR, BR], hypotenuse: [TL, BR] }; // 사선: 좌상→우하
    case "ceil-asc": return { corners: [TL, TR, BL], hypotenuse: [TR, BL] }; // 사선: 우상→좌하
  }
}
/** 사선만 여러 점으로 쪼개 손떨림, 나머지 두 변(타일 경계)은 그대로 — 닫힌 wobbly 경로 */
function wobblySlopePath(dir, W, H, jitterPx, subdivisions = 6) {
  const { corners } = slopeCorners(dir, W, H);
  const [c0, c1, c2] = corners; // c0→c1: 변1(경계), c1→c2: 변2(경계 또는 사선 시작), c2→c0: 사선
  // hypotenuse는 항상 corners[2]→corners[0] 구간이 되도록 slopeCorners를 구성했음(사선이 마지막 변).
  const straightPts = [c0, c1, c2];
  const hypoStart = c2, hypoEnd = c0;
  const hypoPts = [];
  for (let i = 1; i < subdivisions; i++) {
    const t = i / subdivisions;
    const x = hypoStart[0] + (hypoEnd[0] - hypoStart[0]) * t;
    const y = hypoStart[1] + (hypoEnd[1] - hypoStart[1]) * t;
    const nx = -(hypoEnd[1] - hypoStart[1]), ny = hypoEnd[0] - hypoStart[0]; // 법선 방향
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
  const fill = pick(fillHue, [30, 42]); // 본체(흙/돌)
  const surface = pick(surfaceHue, [50, 65]); // 표면 라인(잔디/서리) — 본체와 다른 색상 계열
  const dark = pick(fillHue, [15, 22]);
  const strokeW = Math.max(3, Math.round(Math.min(W, H) * 0.06));

  const body = wobblySlopePath(dir, W, H, Math.min(W, H) * 0.035, 7);
  const { hypotenuse } = slopeCorners(dir, W, H);
  const [hs, he] = hypotenuse;
  // 표면 라인(사선 위에 얹는 밝은 띠) — 살짝 안쪽으로 오프셋한 손떨림 선
  const surfaceLine = wobblyLinePath(hs[0], hs[1], he[0], he[1], Math.min(W, H) * 0.06);

  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <path d="${body}" fill="${fill}"/>
  <path d="${wobblyLinePath((hs[0]+he[0])/2 - (he[0]-hs[0])*0.15, (hs[1]+he[1])/2 - (he[1]-hs[1])*0.15, (hs[0]+he[0])/2 + (he[0]-hs[0])*0.15, (hs[1]+he[1])/2 + (he[1]-hs[1])*0.15, Math.min(W,H)*0.08)}" stroke="${dark}" stroke-width="${strokeW}" opacity="0.35" fill="none"/>
  <path d="${surfaceLine}" stroke="${surface}" stroke-width="${strokeW * 1.4}" stroke-linecap="round" fill="none"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const jobs = [
    { name: "goomba-1x1", tiles: "1x1", fn: genGoomba },
    { name: "piranha-1x2", tiles: "1x2", fn: genPiranha },
    { name: "chainchomp-2x2", tiles: "2x2", fn: genChainChomp },
    { name: "hand-icon", tiles: "1x1(UI, 실사용 14px)", fn: genHandIcon },
    { name: "avatar-01-mario", tiles: "1x2", fn: genMarioAvatar },
    { name: "avatar-02-luigi", tiles: "1x2", fn: genLuigiAvatar },
    { name: "avatar-03-princess", tiles: "1x2", fn: genPrincessAvatar },
    { name: "avatar-04-toad", tiles: "1x2", fn: genToadAvatar },
    { name: "avatar-05-gorilla", tiles: "1x2", fn: genGorillaAvatar },
    { name: "avatar-06-mouse", tiles: "1x2", fn: genMouseAvatar },
    { name: "avatar-07-goose", tiles: "1x2", fn: genGooseAvatar },
    { name: "avatar-08-croc", tiles: "1x2", fn: genCrocAvatar },
    { name: "avatar-09-steve", tiles: "1x2", fn: genSteveAvatar },
    { name: "avatar-10-creeper", tiles: "1x2", fn: genCreeperAvatar },
    { name: "avatar-11-speedster", tiles: "1x2", fn: genSpeedsterAvatar },
    { name: "avatar-12-kirby", tiles: "1x2", fn: genKirbyAvatar },
    { name: "avatar-13-robot", tiles: "1x2", fn: genRobotAvatar },
    { name: "avatar-14-turtleninja", tiles: "1x2", fn: genTurtleNinjaAvatar },
    { name: "avatar-15-knight", tiles: "1x2", fn: genKnightAvatar },
    { name: "avatar-16-pirate", tiles: "1x2", fn: genPirateAvatar },
    { name: "slope-floorasc-2x2", tiles: "2x2", fn: () => genSlope("floor-asc", TILE * 2, TILE * 2, 30, 120) }, // 흙(갈색)+잔디(초록)
    { name: "slope-ceildesc-2x2", tiles: "2x2", fn: () => genSlope("ceil-desc", TILE * 2, TILE * 2, 210, 210) }, // 돌+서리(같은 청계열 명도차)
  ];
  for (const j of jobs) {
    const png = await j.fn();
    const outPath = path.join(OUT_DIR, `${j.name}.png`);
    writeFileSync(outPath, png);
    const meta = await sharp(png).metadata();
    console.log(`생성됨: ${outPath} (${meta.width}x${meta.height}, tiles=${j.tiles})`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
