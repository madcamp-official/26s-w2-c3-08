// 시각 언어 렌더 모듈 (docs/KJH/visual-language.md) — BaseworldScene에서 분리(2026-07-15, 전체 구현).
// §1 항상 표시 + §2 맥락 표시(근접/hover에서만) 전부 포함. 순수 Phaser Graphics 드로잉 함수 모음 —
// 상태 판단(누가 보여야 하는가)은 BaseworldScene이, "어떻게 그리는가"만 여기.
import type Phaser from "phaser";
import type { Slope } from "shared/physics";
import { slopeSurfaceY } from "shared/physics";
import type { FaceBorders } from "shared/visual";
import type { SquashState } from "../../netphysics/squash.js";

// ── 공통 유틸 ──────────────────────────────────────────────────────────────
export const BORDER_WIDTH = 4;   // 이전 2px는 가독성 부족 피드백(2026-07-15) 반영해 굵게

/** 무적/재생성 유예 표시용 알파 점멸 (90ms 주기 토글) — 아바타·고스트·몬스터·블록 공통 */
export function flickerAlpha(nowMs: number): number {
  return Math.floor(nowMs / 90) % 2 === 0 ? 1 : 0.35;
}

/**
 * squash(찌부/밀림 연출) 반영 실제 표시 박스 계산 — 벽에 눌리거나 찌부될 때 시각 사각형
 * (myRect/몬스터 rect)이 squash.offsetX/Y·sx/sy로 움직이는데, 테두리가 body 원좌표만 쓰면
 * 안 따라가는 버그였음(2026-07-15 피드백). rect가 실제로 그려지는 위치·크기와 동일하게 계산.
 * anchorX/Y = 바닥-중앙(Body 좌표계와 동일, origin (0.5,1) rect 기준).
 */
export function squashedBox(
  anchorX: number, anchorY: number, w: number, h: number,
  squash: Pick<SquashState, "sx" | "sy" | "offsetX" | "offsetY">,
): { left: number; top: number; w: number; h: number } {
  const cx = anchorX + squash.offsetX, by = anchorY + squash.offsetY;
  const ew = w * squash.sx, eh = h * squash.sy;
  return { left: cx - ew / 2, top: by - eh, w: ew, h: eh };
}

/** §2 노출도: 근접(거리 페이드) 또는 hover 중 더 큰 쪽. 둘 다 0이면 안 그림(비용 절감). */
export function revealAlpha(distPx: number, nearPx: number, farPx: number, hovering: boolean): number {
  if (hovering) return 1;
  if (distPx <= nearPx) return 1;
  if (distPx >= farPx) return 0;
  return 1 - (distPx - nearPx) / (farPx - nearPx);
}

// ── §1 면별 테두리 (항상 표시) ────────────────────────────────────────────
const BORDER_COLOR: Record<string, number> = {
  solidWhite: 0xffffff,
  dashed: 0xffffff,
  red: 0xff3b30,
  bumper: 0x2ec4c4,
  trampoline: 0x34c759,
};

/**
 * 한 면(선분)을 스타일대로 그림. 내(로컬 플레이어)가 무적이면 "빨강"(위험)이 "흰색"(안전)으로 바뀐다
 * — 처음엔 별도 주황을 썼으나 "그냥 위험 없어지면 흰색으로"가 낫다는 피드백(2026-07-15)으로 단순화.
 */
export function strokeFace(
  gfx: Phaser.GameObjects.Graphics,
  x1: number, y1: number, x2: number, y2: number,
  style: string, iAmInvincible: boolean,
): void {
  if (style === "none") return;
  const effective = style === "red" && iAmInvincible ? "solidWhite" : style;
  const color = BORDER_COLOR[effective];
  if (color === undefined) return;
  gfx.lineStyle(BORDER_WIDTH, color, 0.95);
  if (effective === "dashed") {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const segs = Math.max(2, Math.round(len / 10));
    for (let i = 0; i < segs; i += 2) {
      const t0 = i / segs, t1 = Math.min(1, (i + 1) / segs);
      gfx.lineBetween(x1 + dx * t0, y1 + dy * t0, x1 + dx * t1, y1 + dy * t1);
    }
  } else {
    gfx.lineBetween(x1, y1, x2, y2);
  }
}

/** AABB(top-left+크기) 기준 4면 테두리 (몬스터·플레이어 히트박스용 — 이웃 병합 없이 항상 통짜로 그림) */
export function drawFaceBorders(
  gfx: Phaser.GameObjects.Graphics, left: number, top: number, w: number, h: number,
  faces: FaceBorders, iAmInvincible: boolean,
): void {
  strokeFace(gfx, left, top, left + w, top, faces.top, iAmInvincible);
  strokeFace(gfx, left, top + h, left + w, top + h, faces.bottom, iAmInvincible);
  strokeFace(gfx, left, top, left, top + h, faces.left, iAmInvincible);
  strokeFace(gfx, left + w, top, left + w, top + h, faces.right, iAmInvincible);
}

// ── 이음선(seam) 병합 — 1×1 블록을 이어붙여 바닥을 만들면 타일마다 테두리가 둘러져 보이는 문제
// (피드백 2026-07-15) 방지. "흰 실선(solidWhite)" 면끼리 맞닿은 구간만 지운다 — 위험·특수 면은
// 정보 손실을 막기 위해 항상 통짜로 그린다.
export interface SeamRect { left: number; top: number; w: number; h: number; faces: FaceBorders }

function subtractIntervals(a: number, b: number, covers: Array<[number, number]>): Array<[number, number]> {
  let segs: Array<[number, number]> = [[a, b]];
  for (const [ca, cb] of covers) {
    const next: Array<[number, number]> = [];
    for (const [sa, sb] of segs) {
      if (cb <= sa || ca >= sb) { next.push([sa, sb]); continue; }
      if (ca > sa) next.push([sa, Math.min(ca, sb)]);
      if (cb < sb) next.push([Math.max(cb, sa), sb]);
    }
    segs = next;
  }
  return segs;
}

const EDGE_OPPOSITE = { top: "bottom", bottom: "top", left: "right", right: "left" } as const;
type EdgeName = keyof typeof EDGE_OPPOSITE;

export function drawSeamMergedBorders(gfx: Phaser.GameObjects.Graphics, rects: SeamRect[]): void {
  const EPS = 0.5;
  for (const r of rects) {
    (Object.keys(EDGE_OPPOSITE) as EdgeName[]).forEach((edge) => {
      const style = r.faces[edge];
      if (style === "none") return;
      const isHoriz = edge === "top" || edge === "bottom";
      const coord = edge === "top" ? r.top : edge === "bottom" ? r.top + r.h : edge === "left" ? r.left : r.left + r.w;
      const [a, b] = isHoriz ? [r.left, r.left + r.w] : [r.top, r.top + r.h];
      if (style !== "solidWhite") {
        // 위험·특수 면은 병합 없이 항상 통짜로 (정보를 숨기면 안 됨)
        const [x1, y1] = isHoriz ? [a, coord] : [coord, a];
        const [x2, y2] = isHoriz ? [b, coord] : [coord, b];
        strokeFace(gfx, x1, y1, x2, y2, style, false);
        return;
      }
      const opposite = EDGE_OPPOSITE[edge];
      const covers: Array<[number, number]> = [];
      for (const other of rects) {
        if (other === r || other.faces[opposite] !== "solidWhite") continue;
        const oCoord = opposite === "top" ? other.top : opposite === "bottom" ? other.top + other.h : opposite === "left" ? other.left : other.left + other.w;
        if (Math.abs(oCoord - coord) > EPS) continue;
        const [oa, ob] = isHoriz ? [other.left, other.left + other.w] : [other.top, other.top + other.h];
        if (ob <= a + EPS || oa >= b - EPS) continue;
        covers.push([Math.max(a, oa), Math.min(b, ob)]);
      }
      for (const [ra, rb] of subtractIntervals(a, b, covers)) {
        if (rb - ra < 1) continue;
        const [x1, y1] = isHoriz ? [ra, coord] : [coord, ra];
        const [x2, y2] = isHoriz ? [rb, coord] : [coord, rb];
        strokeFace(gfx, x1, y1, x2, y2, "solidWhite", false);
      }
    });
  }
}

/**
 * 경사(구불구불한 지형) 테두리 — 직사각형이 아니므로 별도 처리. 밟는 표면(대각선)은 항상 흰 실선.
 * 나머지 두 면(높은 쪽 세로 벽·밑면, floor 한정)은 물리와 동일하게 옵션에 따라 실선/점선.
 */
export function drawSlopeBorder(gfx: Phaser.GameObjects.Graphics, s: Slope): void {
  gfx.lineStyle(BORDER_WIDTH, BORDER_COLOR.solidWhite, 0.95);
  if (s.kind === "floor") {
    gfx.lineBetween(s.x, slopeSurfaceY(s, s.x) ?? s.y, s.x + s.w, slopeSurfaceY(s, s.x + s.w) ?? s.y);
    const faces = s.faces ?? {};
    const wallX = s.dir === 1 ? s.x + s.w : s.x;
    strokeFace(gfx, wallX, s.y, wallX, s.y + s.h, faces.side === false ? "dashed" : "solidWhite", false);
    strokeFace(gfx, s.x, s.y + s.h, s.x + s.w, s.y + s.h, faces.bottom === false ? "dashed" : "solidWhite", false);
  } else {
    const y0 = s.y + s.h - ((slopeSurfaceY(s, s.x) ?? s.y) - s.y);
    const y1 = s.y + s.h - ((slopeSurfaceY(s, s.x + s.w) ?? s.y) - s.y);
    gfx.lineBetween(s.x, y0, s.x + s.w, y1);
  }
}

/**
 * 플레이어(§1.2 소속) — 내 아바타 흰색, 다른 플레이어 회색(2026-07-15 피드백으로 반전 —
 * 원안은 회색/흰색이었으나 "내가 흰색"이 더 낫다는 판단). squash 반영된 박스를 그대로 그림.
 */
export function drawPlayerBorder(gfx: Phaser.GameObjects.Graphics, box: { left: number; top: number; w: number; h: number }, isSelf: boolean): void {
  gfx.lineStyle(BORDER_WIDTH - 1, isSelf ? 0xffffff : 0x9a9a9a, 0.9);
  gfx.strokeRect(box.left, box.top, box.w, box.h);
}

/**
 * 스위치 토글러(시스템 ON/OFF 블록) — 문서상 "빨강·파랑 반반 회전". 둘레를 따라 두 색 세그먼트가
 * 실제로 도는 것처럼(marching ants) 그리되, 현재 상태를 못 읽는다는 피드백(2026-07-15)으로
 * 50:50 균등 대신 "지금 상태 색"이 둘레 대부분을 차지하도록(다른 색은 소량만) 비율을 준다.
 * ON=빨강 우세, OFF=청록 우세 (임의 매핑 — 코드 내 유일한 기준).
 */
function drawRotatingStripedRect(
  gfx: Phaser.GameObjects.Graphics, left: number, top: number, w: number, h: number,
  majorColor: number, minorColor: number, majorLen: number, minorLen: number, nowMs: number,
): void {
  const speedPxPerSec = 45;
  const perimeter = 2 * (w + h);
  const cycle = majorLen + minorLen;
  const offset = ((nowMs / 1000) * speedPxPerSec) % cycle;
  const pointAt = (dIn: number): [number, number] => {
    const d = ((dIn % perimeter) + perimeter) % perimeter;
    if (d <= w) return [left + d, top];
    if (d <= w + h) return [left + w, top + (d - w)];
    if (d <= 2 * w + h) return [left + w - (d - w - h), top + h];
    return [left, top + h - (d - 2 * w - h)];
  };
  let d = -offset, isMajor = true;
  while (d < perimeter) {
    const segLen = isMajor ? majorLen : minorLen;
    const d0 = Math.max(d, 0), d1 = Math.min(d + segLen, perimeter);
    if (d1 > d0) {
      const [x0, y0] = pointAt(d0);
      const [x1, y1] = pointAt(d1);
      gfx.lineStyle(BORDER_WIDTH, isMajor ? majorColor : minorColor, 0.9);
      gfx.lineBetween(x0, y0, x1, y1);
    }
    d += segLen;
    isMajor = !isMajor;
  }
}
/**
 * 아래(머리치기)·위(내려찍기) 양쪽 다 발동함을 화살표로 안내(§B4). 물음표 블록엔 있었는데
 * 스위치 토글러엔 아예 없었고, 물음표조차 "내려찍기도 된다"는 안내는 없었음(2026-07-16 피드백).
 */
function drawHitDirectionHints(gfx: Phaser.GameObjects.Graphics, left: number, top: number, w: number, h: number, color: number, alpha: number, nowMs: number): void {
  const cx = left + w / 2;
  const ay = top + h + 5 + 3 * Math.sin(nowMs / 200);   // 아래쪽: 위를 향한 화살표(머리치기)
  gfx.fillStyle(color, alpha);
  gfx.fillTriangle(cx - 5, ay + 6, cx + 5, ay + 6, cx, ay);
  const by = top - 5 - 3 * Math.sin(nowMs / 200);   // 위쪽: 아래를 향한 화살표(내려찍기)
  gfx.fillTriangle(cx - 5, by - 6, cx + 5, by - 6, cx, by);
}

export function drawSwitchTogglerBorder(gfx: Phaser.GameObjects.Graphics, left: number, top: number, w: number, h: number, switchOn: boolean, nowMs: number): void {
  const RED = 0xff3b30, CYAN = 0x2ec4c4;
  const majorColor = switchOn ? RED : CYAN, minorColor = switchOn ? CYAN : RED;
  drawRotatingStripedRect(gfx, left, top, w, h, majorColor, minorColor, 18, 6, nowMs);
  drawHitDirectionHints(gfx, left, top, w, h, 0xffffff, 0.7 + 0.2 * Math.sin(nowMs / 260), nowMs);
}

/** 둘레를 따라 도는 점선(marching ants) — 한 색, dash/gap이 시간에 따라 흘러 "움직인다"는 게 보임 */
function drawMarchingDashedRect(gfx: Phaser.GameObjects.Graphics, left: number, top: number, w: number, h: number, color: number, alpha: number, nowMs: number): void {
  const dashLen = 10, gapLen = 6, speedPxPerSec = 40;
  const perimeter = 2 * (w + h);
  const cycle = dashLen + gapLen;
  const offset = ((nowMs / 1000) * speedPxPerSec) % cycle;
  const pointAt = (dIn: number): [number, number] => {
    const d = ((dIn % perimeter) + perimeter) % perimeter;
    if (d <= w) return [left + d, top];
    if (d <= w + h) return [left + w, top + (d - w)];
    if (d <= 2 * w + h) return [left + w - (d - w - h), top + h];
    return [left, top + h - (d - 2 * w - h)];
  };
  gfx.lineStyle(BORDER_WIDTH - 1, color, alpha);
  let d = -offset;
  while (d < perimeter) {
    const d0 = Math.max(d, 0), d1 = Math.min(d + dashLen, perimeter);
    if (d1 > d0) {
      const [x0, y0] = pointAt(d0);
      const [x1, y1] = pointAt(d1);
      gfx.lineBetween(x0, y0, x1, y1);
    }
    d += cycle;
  }
}

/**
 * 스위치 영향 블록(§1.2) — 실체든 유령이든 항상 점선+움직임으로 통일(2026-07-16 피드백: "숨겨졌다
 * 나타났을 때 실선으로 바뀌는 게 이상하다, 그냥 점선으로 + 스위치 토글러처럼 움직이게").
 * materialized로만 구분: 실체=칠 있음+진한 점선, 유령=칠 옅음+연한 점선.
 */
export function drawSwitchAffectedBorder(gfx: Phaser.GameObjects.Graphics, left: number, top: number, w: number, h: number, whenOn: boolean, switchOn: boolean, materialized: boolean, nowMs: number): void {
  const color = whenOn ? 0xff3b30 : 0x2ec4c4;
  const active = whenOn === switchOn;
  if (materialized) gfx.fillStyle(color, active ? 0.14 : 0.06);
  else gfx.fillStyle(color, 0.22);
  gfx.fillRect(left, top, w, h);
  drawMarchingDashedRect(gfx, left, top, w, h, color, materialized ? (active ? 0.85 : 0.35) : 0.5, nowMs);
}

/**
 * 물음표 블록 등 아이템 주는 에셋 — 어디를 쳐야 하는지 표시(2026-07-15 피드백: 박스 전체 발광은
 * "어디를 쳐야 할지" 안 알려줌). 실제 판정(BaseworldScene bonkHead)이 "아래에서 위로 머리를
 * 부딪혀야" 발동하므로, 아랫면만 굵게 발광 + 그 아래 위쪽 화살표로 "여기를 아래에서 쳐라"를 알림.
 * 옅은 전체 테두리는 유지하되(에셋임을 표시) 아랫면·화살표가 시선을 끌도록 더 강하게.
 */
export function drawItemGiverGlow(gfx: Phaser.GameObjects.Graphics, left: number, top: number, w: number, h: number, nowMs: number): void {
  const pulse = 0.6 + 0.3 * Math.sin(nowMs / 260);
  gfx.lineStyle(2, 0xffee55, pulse * 0.5);
  gfx.strokeRect(left, top, w, h);
  gfx.lineStyle(BORDER_WIDTH, 0xffee55, pulse);
  gfx.lineBetween(left, top + h, left + w, top + h);
  drawHitDirectionHints(gfx, left, top, w, h, 0xffee55, pulse, nowMs);
}

/** 아이템 스프링 확대·축소 펄스 배율 (§1.2 신규 구현) — 아이템 rect의 setScale에 곱해 쓴다 */
export function itemPulseScale(nowMs: number, periodMs: number, amt: number): number {
  return 1 + amt * Math.sin((nowMs / periodMs) * Math.PI * 2);
}

// ── §2 맥락 표시 (근접/hover 게이팅 — reveal 0이면 호출부에서 스킵 권장) ────────────────

/** 컨베이어 방향 화살표 — 윗면에 벨트 방향으로 흐르는 화살표 2~3개 */
export function drawConveyorArrows(gfx: Phaser.GameObjects.Graphics, left: number, top: number, w: number, dir: "left" | "right", nowMs: number, reveal: number): void {
  if (reveal <= 0) return;
  const sign = dir === "right" ? 1 : -1;
  const cycle = 40;
  const offset = ((nowMs / 12) % cycle);
  gfx.lineStyle(2, 0xffffff, 0.75 * reveal);
  for (let x = left - cycle; x < left + w + cycle; x += cycle) {
    const ax = x + sign * offset;
    if (ax < left || ax > left + w - 8) continue;
    const y = top - 3;
    gfx.lineBetween(ax, y, ax + sign * 8, y);
    gfx.lineBetween(ax + sign * 8, y, ax + sign * 4, y - 4);
    gfx.lineBetween(ax + sign * 8, y, ax + sign * 4, y + 4);
  }
}

/** 얼음(미끄러움) 서리/광택 — 윗면에 옅은 반짝임 */
export function drawIceGlint(gfx: Phaser.GameObjects.Graphics, left: number, top: number, w: number, nowMs: number, reveal: number): void {
  if (reveal <= 0) return;
  gfx.fillStyle(0xbfe8ff, 0.35 * reveal);
  for (let i = 0; i < 3; i++) {
    const x = left + ((i + 0.5) / 3) * w;
    const twinkle = 0.5 + 0.5 * Math.sin(nowMs / 300 + i * 2);
    gfx.fillCircle(x, top - 4, 2 * twinkle);
  }
}

/** 대시(가속판) 스피드 라인 — 수평 3줄 */
export function drawDashLines(gfx: Phaser.GameObjects.Graphics, left: number, top: number, w: number, h: number, reveal: number): void {
  if (reveal <= 0) return;
  gfx.lineStyle(2, 0xffe08a, 0.7 * reveal);
  for (let i = 0; i < 3; i++) {
    const y = top + h * (0.3 + i * 0.2);
    gfx.lineBetween(left + w * 0.15, y, left + w * 0.85, y);
  }
}

/** 바운시 윗면 위쪽 화살표 */
export function drawBounceArrow(gfx: Phaser.GameObjects.Graphics, centerX: number, top: number, reveal: number): void {
  if (reveal <= 0) return;
  gfx.lineStyle(2, 0x34c759, 0.8 * reveal);
  const y0 = top - 4, y1 = top - 14;
  gfx.lineBetween(centerX, y0, centerX, y1);
  gfx.lineBetween(centerX, y1, centerX - 4, y1 + 5);
  gfx.lineBetween(centerX, y1, centerX + 4, y1 + 5);
}

/** 이동 텔레그래프 — 현재 속도 방향 화살표 (patrol/spin/pendulum/shuttle 등) */
export function drawDirectionArrow(gfx: Phaser.GameObjects.Graphics, cx: number, cy: number, vx: number, vy: number, reveal: number): void {
  if (reveal <= 0) return;
  const len = Math.hypot(vx, vy);
  if (len < 1) return;
  const ux = vx / len, uy = vy / len;
  const size = 14;
  const tipX = cx + ux * size, tipY = cy + uy * size;
  gfx.lineStyle(2, 0xffffff, 0.75 * reveal);
  gfx.lineBetween(cx, cy, tipX, tipY);
  const bx = -uy, by = ux;
  gfx.lineBetween(tipX, tipY, tipX - ux * 5 + bx * 4, tipY - uy * 5 + by * 4);
  gfx.lineBetween(tipX, tipY, tipX - ux * 5 - bx * 4, tipY - uy * 5 - by * 4);
}

/** "밟으면 출발" 힌트 — ride_start 블록 위 상향 이중 화살표 */
export function drawRideHint(gfx: Phaser.GameObjects.Graphics, centerX: number, top: number, reveal: number): void {
  if (reveal <= 0) return;
  gfx.lineStyle(2, 0xffffff, 0.7 * reveal);
  for (const dy of [0, 6]) {
    const y = top - 8 - dy;
    gfx.lineBetween(centerX - 5, y + 4, centerX, y);
    gfx.lineBetween(centerX + 5, y + 4, centerX, y);
  }
}

/** 근접(proximity) 감지 반경 링 — 안에 들어가면 더 밝게(경계 발광) */
export function drawDetectRing(gfx: Phaser.GameObjects.Graphics, cx: number, cy: number, radiusPx: number, playerInside: boolean, reveal: number): void {
  if (reveal <= 0) return;
  gfx.lineStyle(1, 0xffffff, (playerInside ? 0.5 : 0.22) * reveal);
  gfx.strokeCircle(cx, cy, radiusPx);
}

/**
 * 테두리 자체가 지글거리는(sizzle) 경고 라인 — 사각형을 통째로 옮기는 게 아니라, 둘레를 짧은
 * 구간으로 쪼개서 구간마다 서로 다른 위상으로 따로 떨리게 그린다(2026-07-16 피드백:
 * "그냥 흔들렸으면 좋겠음. 지글지글하게. 통째로 움직이는게 아니라").
 */
function drawSizzlingRect(gfx: Phaser.GameObjects.Graphics, left: number, top: number, w: number, h: number, color: number, alpha: number, jitterAmt: number, nowMs: number): void {
  const perimeter = 2 * (w + h);
  const segLen = 9;
  const pointAt = (dIn: number): [number, number] => {
    const d = ((dIn % perimeter) + perimeter) % perimeter;
    if (d <= w) return [left + d, top];
    if (d <= w + h) return [left + w, top + (d - w)];
    if (d <= 2 * w + h) return [left + w - (d - w - h), top + h];
    return [left, top + h - (d - 2 * w - h)];
  };
  gfx.lineStyle(2, color, alpha);
  for (let d = 0; d < perimeter; d += segLen) {
    const [x0, y0] = pointAt(d), [x1, y1] = pointAt(Math.min(d + segLen, perimeter));
    const phase = d * 0.9;   // 구간마다 다른 위상 → 서로 따로 흔들림(끓는 느낌)
    const jx0 = Math.sin(nowMs / 30 + phase) * jitterAmt, jy0 = Math.cos(nowMs / 24 + phase * 1.3) * jitterAmt;
    const jx1 = Math.sin(nowMs / 30 + phase + 1.5) * jitterAmt, jy1 = Math.cos(nowMs / 24 + (phase + 1.5) * 1.3) * jitterAmt;
    gfx.lineBetween(x0 + jx0, y0 + jy0, x1 + jx1, y1 + jy1);
  }
}

/**
 * 붕괴/파괴 예고 — "금 가는" 그림은 블록이 사각형이 아니거나(경사·천장 등) 유저가 그린 그림이
 * 구불구불한 임의 모양이면 안 맞는다는 지적(2026-07-16)으로 폐기. 대신 **도형에 전혀 의존하지
 * 않는** 신호로 대체: ①테두리 지글거림(둘레 구간별로 따로 떨림, 안 흔들리는 카운트다운 링과
 * 대비돼서 "불안정함"이 더 잘 읽힘) ②머리 위 카운트다운 링(남은 시간을 파이 형태로 소진) —
 * 어떤 모양의 에셋이든 항상 통한다.
 */
export function drawCrumbleWarning(gfx: Phaser.GameObjects.Graphics, left: number, top: number, w: number, h: number, nowMs: number, progress = 1): void {
  const flicker = 0.5 + 0.5 * Math.sin(nowMs / (150 - progress * 100));   // 진행될수록 더 빠르게 깜빡
  const jitterAmt = 0.5 + progress * 3.5;   // 진행될수록 더 격하게 지글거림
  drawSizzlingRect(gfx, left, top, w, h, 0xffcc33, flicker * (0.4 + progress * 0.55), jitterAmt, nowMs);

  const cx = left + w / 2, ringY = top - 12, ringR = 7;   // 링은 고정 — 지글거리는 테두리와 대비되는 안정적 기준점
  gfx.lineStyle(2, 0x222222, 0.45);
  gfx.strokeCircle(cx, ringY, ringR);
  gfx.lineStyle(2, 0xffcc33, 0.95);
  gfx.beginPath();
  gfx.arc(cx, ringY, ringR, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2, false);
  gfx.strokePath();
}

/** 점멸(blink) 블록 — 사라지기 직전 예고(빠른 알파 요동). msLeft = 다음 전환까지 남은 시간 */
export function drawPeriodicWarning(gfx: Phaser.GameObjects.Graphics, left: number, top: number, w: number, h: number, msLeft: number, nowMs: number): void {
  if (msLeft > 500) return;   // 임박했을 때만
  const a = 0.3 + 0.5 * Math.abs(Math.sin(nowMs / 60));
  gfx.lineStyle(2, 0xffffff, a);
  gfx.strokeRect(left, top, w, h);
}

/** HP 핍 — 머리 위 남은 타격 수 */
export function drawHpPips(gfx: Phaser.GameObjects.Graphics, cx: number, topY: number, total: number, remaining: number, reveal: number): void {
  if (reveal <= 0) return;
  const size = 6, gap = 3;
  const totalW = total * size + (total - 1) * gap;
  let x = cx - totalW / 2;
  for (let i = 0; i < total; i++) {
    gfx.fillStyle(i < remaining ? 0xff3b30 : 0x444444, 0.9 * reveal);
    gfx.fillRect(x, topY - 12, size, size);
    x += size + gap;
  }
}

/** 분노(enrage) 경고 — 머리 위 "!" */
export function drawEnrageMark(gfx: Phaser.GameObjects.Graphics, cx: number, topY: number, reveal: number): void {
  if (reveal <= 0) return;
  gfx.lineStyle(3, 0xff9500, 0.85 * reveal);
  const y = topY - 20;
  gfx.lineBetween(cx, y, cx, y + 8);
  gfx.fillStyle(0xff9500, 0.85 * reveal);
  gfx.fillCircle(cx, y + 12, 1.5);
}

/** 발사(shooter) — 바라보는 방향에 작은 발사구 삼각형 */
export function drawShooterMark(gfx: Phaser.GameObjects.Graphics, cx: number, cy: number, facing: number, reveal: number): void {
  if (reveal <= 0) return;
  gfx.fillStyle(0xffffff, 0.7 * reveal);
  const x = cx + facing * 10;
  gfx.fillTriangle(x, cy - 4, x, cy + 4, x + facing * 6, cy);
}

/** 분열(splitOnDeath) — 머리 위 갈라짐 표시 */
export function drawSplitMark(gfx: Phaser.GameObjects.Graphics, cx: number, topY: number, reveal: number): void {
  if (reveal <= 0) return;
  gfx.lineStyle(2, 0xcc66ff, 0.8 * reveal);
  const y = topY - 16;
  gfx.lineBetween(cx - 5, y - 5, cx, y + 5);
  gfx.lineBetween(cx + 5, y - 5, cx, y + 5);
}

/**
 * 체력 무한(처치 불가) — 머리 위 다이아몬드(◇) 표시. HP 핍은 hp=999 같은 값에서 의미가 없어
 * (실사용 확인: 핍 수백 개가 그려지는 문제) 대신 이 마크로 대체. §1(항상 표시) — 처치 가능
 * 여부는 생존 판단에 중요한 정보라 근접/hover 게이팅 없이 항상 그림.
 */
export function drawImmortalMark(gfx: Phaser.GameObjects.Graphics, cx: number, topY: number): void {
  const y = topY - 14, r = 5;
  gfx.lineStyle(2, 0xdddddd, 0.9);
  gfx.lineBetween(cx, y - r, cx + r, y);
  gfx.lineBetween(cx + r, y, cx, y + r);
  gfx.lineBetween(cx, y + r, cx - r, y);
  gfx.lineBetween(cx - r, y, cx, y - r);
}
