// baseworld 씬: 로컬 권위 아바타 + 고스트/몬스터 표현 + 자기화면 판정(§14) + serverview.
// Phaser는 렌더·입력만 (물리는 shared).
import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import { getStateCallbacks } from "@colyseus/sdk";
import { TUNING, type Terrain, type Slope, slopeSurfaceY, facesOf } from "shared/physics";
import "shared/behavior";
import "shared/properties";
import {
  type Avatar, type AvatarInput, createAvatar, stepAvatar, applyItem, clearItemEffects,
  pushSelfOut, checkIStomped, checkStompedMe, headStand,
  createCarryState, stepCarry, type CarryState, type Carryable,
  blockRect, type ItemSpec,
} from "shared/parts";
import { getProperty } from "shared/properties";
import { TESTMAP } from "shared/maps";
import {
  createGhostView, ghostServerUpdate, ghostStep, ghostSnapshot, ghostRenderAt, type GhostView,
} from "../../netphysics/interpolate.js";
import { sendAvatarState } from "../../netphysics/reconcile.js";
import { createSquash, setSquash, stepSquash, type SquashState } from "../../netphysics/squash.js";
import { feedback, monsterPatternChanged } from "../../fx/dispatch.js";
import { unlockAudio } from "../../audio/zzfx.js";
import { setListenerPosition } from "../../audio/listener.js";
import { playSound } from "../../audio/sfx.js";
import { blockVisualTagsFromSpec, monsterVisualTagsFromSpec, type FaceBorders } from "shared/visual";

const FIXED_MS = 1000 / TUNING.world.tickRate;

/** 무적/재생성 유예 표시용 알파 점멸 (90ms 주기 토글) — 아바타·고스트·몬스터·블록 공통 */
function flickerAlpha(nowMs: number): number {
  return Math.floor(nowMs / 90) % 2 === 0 ? 1 : 0.35;
}

// ── 시각 언어 렌더 (visual-language.md §1 항상 표시분만 — §2 맥락 표시는 범위 밖) ──────
const BORDER_COLOR: Record<string, number> = {
  solidWhite: 0xffffff,
  dashed: 0xffffff,
  red: 0xff3b30,
  bumper: 0x2ec4c4,
  trampoline: 0x34c759,
};

const BORDER_WIDTH = 4;   // 이전 2px는 가독성 부족 피드백(2026-07-15) 반영해 굵게

/**
 * 한 면(선분)을 스타일대로 그림. 내(로컬 플레이어)가 무적이면 "빨강"(위험)이 "흰색"(안전)으로 바뀐다
 * — 처음엔 별도 주황을 썼으나 "그냥 위험 없어지면 흰색으로"가 낫다는 피드백(2026-07-15)으로 단순화.
 * 흰색은 이미 "안전한 면"의 의미(솔리드 지형·밟기 가능한 몬스터 윗면)라 새 색 개념을 안 늘려도 됨.
 */
function strokeFace(
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

/** AABB(top-left+크기) 기준 4면 테두리 (몬스터 히트박스용 — 이웃 병합 없이 항상 통짜로 그림) */
function drawFaceBorders(
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
// 정보 손실을 막기 위해 항상 통짜로 그린다(drawFaceBorders 그대로 사용).
interface SeamRect { left: number; top: number; w: number; h: number; faces: FaceBorders }

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

function drawSeamMergedBorders(gfx: Phaser.GameObjects.Graphics, rects: SeamRect[]): void {
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
 * 경사(구불구불한 지형) 테두리 — 직사각형이 아니므로 별도 처리. 밟는 표면(대각선)만 흰 실선으로 그림
 * (경사는 항상 단단한 바닥/천장이라 다른 색 상태가 없음 — solidWhite 고정).
 */
function drawSlopeBorder(gfx: Phaser.GameObjects.Graphics, s: Slope): void {
  gfx.lineStyle(BORDER_WIDTH, BORDER_COLOR.solidWhite, 0.95);
  if (s.kind === "floor") {
    gfx.lineBetween(s.x, slopeSurfaceY(s, s.x) ?? s.y, s.x + s.w, slopeSurfaceY(s, s.x + s.w) ?? s.y);
  } else {
    // 천장 경사: body.ts와 동일한 반전 공식으로 실제 닿는 밑면 계산
    const y0 = s.y + s.h - ((slopeSurfaceY(s, s.x) ?? s.y) - s.y);
    const y1 = s.y + s.h - ((slopeSurfaceY(s, s.x + s.w) ?? s.y) - s.y);
    gfx.lineBetween(s.x, y0, s.x + s.w, y1);
  }
}

/**
 * squash(찌부/밀림 연출) 반영 실제 표시 박스 계산 — 벽에 눌리거나 찌부될 때 시각 사각형
 * (myRect/몬스터 rect)이 squash.offsetX/Y·sx/sy로 움직이는데, 테두리가 body 원좌표만 쓰면
 * 안 따라가는 버그였음(2026-07-15 피드백). rect가 실제로 그려지는 위치·크기와 동일하게 계산.
 * anchorX/Y = 바닥-중앙(Body 좌표계와 동일, origin (0.5,1) rect 기준).
 */
function squashedBox(
  anchorX: number, anchorY: number, w: number, h: number,
  squash: Pick<SquashState, "sx" | "sy" | "offsetX" | "offsetY">,
): { left: number; top: number; w: number; h: number } {
  const cx = anchorX + squash.offsetX, by = anchorY + squash.offsetY;
  const ew = w * squash.sx, eh = h * squash.sy;
  return { left: cx - ew / 2, top: by - eh, w: ew, h: eh };
}

/** 플레이어(§1.2 소속) — 내 아바타 회색, 다른 플레이어 흰색. squash 반영된 박스를 받아 그대로 그림. */
function drawPlayerBorder(gfx: Phaser.GameObjects.Graphics, box: { left: number; top: number; w: number; h: number }, isSelf: boolean): void {
  gfx.lineStyle(BORDER_WIDTH - 1, isSelf ? 0x9a9a9a : 0xffffff, 0.9);
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
function drawSwitchTogglerBorder(gfx: Phaser.GameObjects.Graphics, left: number, top: number, w: number, h: number, switchOn: boolean, nowMs: number): void {
  const RED = 0xff3b30, CYAN = 0x2ec4c4;
  const majorColor = switchOn ? RED : CYAN, minorColor = switchOn ? CYAN : RED;
  drawRotatingStripedRect(gfx, left, top, w, h, majorColor, minorColor, 18, 6, nowMs);
}

/** 스위치 영향 블록 — 현재 스위치 상태와 자신의 발동 조건이 일치하면 진하게, 아니면 옅게 틴트 */
function drawSwitchAffectedBorder(gfx: Phaser.GameObjects.Graphics, left: number, top: number, w: number, h: number, whenOn: boolean, switchOn: boolean): void {
  const active = whenOn === switchOn;
  gfx.lineStyle(BORDER_WIDTH - 1, whenOn ? 0xff3b30 : 0x2ec4c4, active ? 0.85 : 0.3);
  gfx.strokeRect(left, top, w, h);
}

interface View {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  ghost: GhostView;
  squash: SquashState;
  w: number; h: number;
  fxLeftMs: number;   // 연출 유예 (접촉 순간 끊김 시 깜빡임 방지)
  lastTick: number;   // 마지막으로 본 상대 tick (백그라운드=정지 감지용)
  lastTickAt: number; // tick이 마지막으로 오른 시각(ms)
  stale: boolean;     // 일정 시간 tick 정지 = 탭 백그라운드 → 충돌 통과(B)
  pound: number;      // 상대 내려찍기 상태 (넉백+스턴 판정용)
  ghostPushLeftMs: number;  // 상대-밀기(노이즈) 스무딩 잔여 — iPush(내 입력)는 즉시라 스무딩 안 함
}

export class BaseworldScene extends Phaser.Scene {
  room: Room;
  me: Avatar = createAvatar(TESTMAP.spawn.x, TESTMAP.spawn.y, TUNING.sizes.playerHeight);
  carry: CarryState = createCarryState();
  mySquash = createSquash();
  tick = 0;
  acc = 0;
  sendAcc = 0;
  keys!: Record<"left" | "right" | "jump" | "down" | "run" | "grab", Phaser.Input.Keyboard.Key[]>;
  players = new Map<string, View>();
  monsters = new Map<string, View>();
  /** 몬스터 사운드/연출용 상태 전이 추적 (MonsterState 필드 엣지 감지 — 서버 emit이 클라에 직접 안 옴) */
  monsterFx = new Map<string, { alive: boolean; stunned: boolean; hidden: boolean; action: string }>();
  /** 다른 플레이어(고스트) 사운드용 상태 전이 추적 — PlayerState에 없는 필드(dead·wallJump)는 재현 불가(TODO) */
  playerFx = new Map<string, {
    grounded: boolean; slide: boolean; pound: number;
    clinging: boolean; dead: boolean; invincible: boolean; wallJumpSeq: number;
  }>();
  projectiles = new Map<string, Phaser.GameObjects.Rectangle>();
  itemRects = new Map<string, Phaser.GameObjects.Rectangle>();
  carryRects = new Map<string, Phaser.GameObjects.Rectangle>();
  blockRects = new Map<string, Phaser.GameObjects.Rectangle>();
  // 보간 상태 (dead reckoning) — 모든 움직이는 것 (§21-1)
  projGhosts = new Map<string, GhostView>();
  carryGhosts = new Map<string, GhostView>();
  blockGhosts = new Map<string, GhostView>();
  // 몬스터 로컬 타격 확정 (서버 왕복 안 기다림) — id → {예측 타격수, 시각}
  localMonHits = new Map<string, { count: number; at: number }>();
  myRect!: Phaser.GameObjects.Rectangle;
  handRect!: Phaser.GameObjects.Rectangle;
  debugGfx!: Phaser.GameObjects.Graphics;
  // 시각 언어(면별 테두리) — 두 레이어로 분리(피드백 2026-07-15: "스프라이트가 테두리보다 뒤에 있다").
  // groundVisualGfx: 지형·블록(자기 채움 위·엔티티 아래) — 캐릭터가 지나가면 자연스럽게 가림.
  // entityVisualGfx: 몬스터·플레이어(자기 몸 위) — 자기 사각형에 가려지면 안 보이므로 항상 위.
  visualGfx!: Phaser.GameObjects.Graphics;
  entityVisualGfx!: Phaser.GameObjects.Graphics;
  // serverview (§19): 주체 필터 + 옵션 1(스프라이트박스)/2(히트박스)/3(서버상태)
  svSubject: "all" | "player" | "terrain" | "monster" = "all";
  svOpts = new Set<number>();
  dead = false;
  deadUntil = 0;
  // 매크로 (§11 스펙): record → stop(확정) → play reset|loop
  macroState: "idle" | "recording" | "playing" = "idle";
  macroBuf: AvatarInput[] = [];
  macroIdx = 0;
  macroMode: "reset" | "loop" = "loop";
  macroStart = { x: 0, y: 0 };
  grabHighlightUntil = 0;
  monsterHitSeq = 0;
  // 자기 스프라이트 연출 (유예 포함): kind/dir/amount/남은ms
  selfFx = { kind: "none" as "none" | "stomped" | "shift" | "squeeze" | "ceil", dir: 1, amt: 8, left: 0, centered: false };
  prevGrounded = false;   // 착지·점프 전이 감지(사운드/이펙트)
  prevClinging = false;   // 벽 잡기(클링) 전이 감지
  prevSlide = false;      // 경사 슬라이딩 전이 감지

  constructor(room: Room) {
    super("baseworld");
    this.room = room;
  }

  /** 지연 큰 환경: join 직후 첫 상태 도착 전엔 스키마 맵이 undefined (§28 가드) */
  stateReady(): boolean {
    const s = this.room.state;
    return !!(s && s.players && s.blocks && s.monsters && s.items && s.projectiles && s.carryables);
  }

  // ── 지형 (동적 블록 반영) ──
  currentTerrain(): Terrain {
    const solids = [...TESTMAP.terrain.solids];
    if (!this.room.state?.blocks) return { solids, slopes: TESTMAP.terrain.slopes };
    this.room.state.blocks.forEach((bs: { x: number; y: number; active: boolean; visibleNow: boolean }, id: string) => {
      if (!bs.active || !bs.visibleNow) return;
      const spec = TESTMAP.blocks.find((b) => b.id === id);
      if (!spec) return;
      const g = this.blockGhosts.get(id);   // 충돌도 보간 위치로 (렌더와 일치 → 라이딩 일관)
      const bx = g ? g.x : bs.x, by = g ? g.y : bs.y;
      solids.push({ x: bx, y: by, w: spec.w, h: spec.h, faces: spec.faces });
    });
    return { solids, slopes: TESTMAP.terrain.slopes };
  }

  create(): void {
    const t = TUNING.world.tileSize;
    // 격자 + 지형
    const grid = this.add.graphics().setDepth(-2);
    grid.lineStyle(1, 0xffffff, 0.06);
    for (let x = 0; x <= TESTMAP.width; x += t) grid.lineBetween(x, 0, x, TESTMAP.height);
    for (let y = 0; y <= TESTMAP.height; y += t) grid.lineBetween(0, y, TESTMAP.width, y);
    for (const s of TESTMAP.terrain.solids) {
      this.add.rectangle(s.x, s.y, s.w, s.h, 0x555566).setOrigin(0, 0).setDepth(-1);
    }
    const slopeG = this.add.graphics().setDepth(-1);
    slopeG.fillStyle(0x555566, 1);
    for (const s of TESTMAP.terrain.slopes) {
      if (s.dir === 1) slopeG.fillTriangle(s.x, s.y + s.h, s.x + s.w, s.y + s.h, s.x + s.w, s.y);
      else slopeG.fillTriangle(s.x, s.y + s.h, s.x + s.w, s.y + s.h, s.x, s.y);
    }
    // 깃발 (라인 경계 시각화)
    this.add.rectangle(TESTMAP.line.startX + 8, TESTMAP.spawn.y - 96, 8, 96, 0x44ff44).setOrigin(0, 0).setDepth(-1);
    this.add.rectangle(TESTMAP.line.endX - 16, TESTMAP.spawn.y - 96, 8, 96, 0xffd744).setOrigin(0, 0).setDepth(-1);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)],
      right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
      jump: [kb.addKey(K.SPACE), kb.addKey(K.UP), kb.addKey(K.W)],
      down: [kb.addKey(K.DOWN), kb.addKey(K.S)],
      run: [kb.addKey(K.SHIFT)],
      grab: [kb.addKey(K.K)],
    };
    kb.disableGlobalCapture();
    // 오디오 자동재생 정책: 첫 제스처에서 해제
    this.input.keyboard!.once("keydown", unlockAudio);
    this.input.once("pointerdown", unlockAudio);

    // 내 아바타
    this.myRect = this.add.rectangle(0, 0, this.me.body.w, this.me.body.h, 0x4488ff).setOrigin(0.5, 1).setDepth(5);
    this.handRect = this.add.rectangle(0, 0, 14, 14, 0xffffff).setDepth(6).setVisible(false);
    this.debugGfx = this.add.graphics().setDepth(20);
    this.visualGfx = this.add.graphics().setDepth(2.5);       // 블록(2) 위, 아이템·엔티티(3~5) 아래
    this.entityVisualGfx = this.add.graphics().setDepth(5.5); // 몬스터·플레이어(4~5) 전부 위

    const $ = getStateCallbacks(this.room);
    // 고스트 플레이어
    $(this.room.state).players.onAdd((p: PlayerNet, id: string) => {
      if (id === this.room.sessionId) return;
      const v = this.makeView(p.x, p.y, p.w, p.h, 0xff5555, p.nickname || id.slice(0, 4));
      this.players.set(id, v);
    });
    $(this.room.state).players.onRemove((_p: PlayerNet, id: string) => { this.dropView(this.players, id); this.playerFx.delete(id); });
    // 몬스터
    $(this.room.state).monsters.onAdd((m: MonsterNet, id: string) => {
      const v = this.makeView(m.x, m.y, m.w, m.h, 0xcc66ff, m.asset);
      this.monsters.set(id, v);
    });
    $(this.room.state).monsters.onRemove((_m: MonsterNet, id: string) => { this.dropView(this.monsters, id); this.monsterFx.delete(id); });
    // 발사체
    $(this.room.state).projectiles.onAdd((pr: ProjNet, id: string) => {
      this.projectiles.set(id, this.add.rectangle(pr.x, pr.y, TUNING.sizes.projectile, TUNING.sizes.projectile, 0xffaa33).setOrigin(0.5, 1).setDepth(4));
    });
    $(this.room.state).projectiles.onRemove((pr: ProjNet, id: string) => {
      this.projectiles.get(id)?.destroy();
      this.projectiles.delete(id);
      this.projGhosts.delete(id);
      feedback.projectileHit(this, pr.x, pr.y);
    });
    // 아이템
    $(this.room.state).items.onAdd((it: ItemNet, id: string) => {
      this.itemRects.set(id, this.add.rectangle(it.x, it.y, TUNING.sizes.item, TUNING.sizes.item, 0x66ffcc).setOrigin(0.5, 1).setDepth(3));
    });
    // 잡기 파츠 (돌)
    $(this.room.state).carryables.onAdd((c: CarryNet, id: string) => {
      this.carryRects.set(id, this.add.rectangle(c.x, c.y, TUNING.sizes.carryable, TUNING.sizes.carryable, 0xb08850).setOrigin(0.5, 1).setDepth(3));
    });
    // 잡기 거부 (서버 소유권 패배 §30-4) — 손에서 사라짐, 이전 행동 원복 없음
    this.room.onMessage("grabDenied", (m: { objId: string }) => {
      if (this.carry.heldId === m.objId) this.carry.heldId = null;
      feedback.grabDenied(this, this.me.body.x, this.me.body.y);
    });
    // 블록
    $(this.room.state).blocks.onAdd((bs: BlockNet, id: string) => {
      const spec = TESTMAP.blocks.find((b) => b.id === id);
      if (!spec) return;
      this.blockRects.set(id, this.add.rectangle(bs.x, bs.y, spec.w, spec.h, 0x8888aa).setOrigin(0, 0).setDepth(2));
    });
    // 아이템 획득 중재 결과 (§60)
    this.room.onMessage("itemClaim", (m: { itemId: string; winner: string | null }) => {
      if (m.winner === this.room.sessionId) {
        const spec = TESTMAP.items.find((i) => i.id === m.itemId)
          ?? ({ id: m.itemId, kind: this.room.state.items.get(m.itemId)?.kind ?? "speed", x: 0, y: 0 } as ItemSpec);
        applyItem(this.me, spec);
        feedback.pickup(this, this.me.body.x, this.me.body.y, spec.kind);
      }
    });
    this.room.onMessage("tp", (m: { sessionId: string; x: number; y: number }) => {
      if (m.sessionId === this.room.sessionId) { this.me.body.x = m.x; this.me.body.y = m.y; }
    });

    this.cameras.main.setBounds(0, 0, TESTMAP.width, TESTMAP.height);
    this.cameras.main.startFollow(this.myRect, true, 0.15, 0.15);
  }

  makeView(x: number, y: number, w: number, h: number, color: number, name: string): View {
    return {
      rect: this.add.rectangle(x, y, w, h, color).setOrigin(0.5, 1).setDepth(4),
      label: this.add.text(x, y - h - 14, name, { fontSize: "12px", color: "#fff" }).setOrigin(0.5, 1).setDepth(5),
      ghost: createGhostView(x, y),
      squash: createSquash(),
      w, h,
      fxLeftMs: 0,
      lastTick: -1, lastTickAt: 0, stale: false,
      pound: 0, ghostPushLeftMs: 0,
    };
  }
  dropView(map: Map<string, View>, id: string): void {
    const v = map.get(id);
    v?.rect.destroy(); v?.label.destroy();
    map.delete(id);
  }

  update(_time: number, delta: number): void {
    this.acc += delta;
    while (this.acc >= FIXED_MS) { this.acc -= FIXED_MS; this.fixedTick(); }
    this.render(delta);
  }

  held(k: keyof BaseworldScene["keys"]): boolean {
    return this.keys[k].some((key) => key.isDown);
  }

  /** 몬스터 유효 타격수 = 서버값과 내 로컬 예측(2초 유효) 중 큰 값 (로컬 확정) */
  monEffHits(id: string, serverHits: number): number {
    const e = this.localMonHits.get(id);
    return e && this.time.now - e.at < 2000 ? Math.max(serverHits, e.count) : serverHits;
  }

  /** 이동 발판 보간 전진: 충돌(currentTerrain)·렌더가 같은 위치를 쓰도록 fixedTick에서 갱신 */
  stepBlockGhosts(): void {
    if (!this.room.state?.blocks) return;
    this.room.state.blocks.forEach((bs: BlockNet, id: string) => {
      let g = this.blockGhosts.get(id);
      if (!g) { g = createGhostView(bs.x, bs.y); this.blockGhosts.set(id, g); }
      if (bs.x !== g.srvX || bs.y !== g.srvY) ghostServerUpdate(g, bs.x, bs.y, bs.vx, bs.vy); // 새 패치만
      ghostStep(g, FIXED_MS, TUNING.net.monsterLerp);
    });
  }

  fixedTick(): void {
    if (!this.stateReady()) return;   // 첫 상태 도착 전 스킵 (§28)
    this.tick++;
    this.stepBlockGhosts();           // 죽어도 발판은 계속 움직여야 하므로 dead 체크 앞
    const now = this.time.now;
    if (this.dead) {
      if (now >= this.deadUntil) this.respawn();
      return;
    }
    let input: AvatarInput = {
      left: this.held("left"), right: this.held("right"),
      jump: this.held("jump"), down: this.held("down"),
      run: this.held("run"), grab: this.held("grab"), tick: this.tick,
    };
    // ── 매크로: 녹화 = 실제 입력 기록 / 재생 = 버퍼 입력으로 대체 (§11) ──
    if (this.macroState === "recording") {
      this.macroBuf.push({ ...input });
    } else if (this.macroState === "playing" && this.macroBuf.length > 0) {
      if (this.macroIdx >= this.macroBuf.length) {
        this.macroIdx = 0;
        if (this.macroMode === "reset") {
          // 위치·능력 전부 초기화 (로컬 권위라 서버 동기화 불필요 — relay가 전파)
          this.me = createAvatar(this.macroStart.x, this.macroStart.y, TUNING.sizes.playerHeight);
        }
      }
      input = { ...this.macroBuf[this.macroIdx++], tick: this.tick };
    }
    const terrain = this.currentTerrain();
    const b = this.me.body;
    const prevVy = b.vy;
    const prevPound = this.me.pound;
    const prevBottomY = b.y;   // 스윕 밟기 판정용(직전 발 위치)

    stepAvatar(this.me, input, FIXED_MS, terrain);

    // ── 사운드/이펙트 배선: 착지·점프 전이 ──
    if (b.grounded && !this.prevGrounded) {
      // 내려찍기 착지는 일반 착지보다 무거운 임팩트로 대체(둘 다 안 겹치게)
      if (this.me.fx.has("poundLand")) feedback.poundLand(this, b.x, b.y);
      else feedback.land(this, b.x, b.y);
    } else if (!b.grounded && this.prevGrounded && b.vy < 0) {
      feedback.jump(this, b.x, b.y);
    }
    this.prevGrounded = b.grounded;

    // ── 사운드/이펙트: 벽 잡기(클링) 전이 ──
    const clinging = !b.grounded && b.touchingWall !== 0;
    if (clinging && !this.prevClinging) feedback.wallGrab(this, b.x, b.y);
    this.prevClinging = clinging;

    // ── 사운드/이펙트: 경사 슬라이딩 전이 ──
    if (this.me.slide && !this.prevSlide) feedback.slideStart(this, b.x, b.y);
    this.prevSlide = this.me.slide;

    // ── PvP: 자기 화면 판정 (§14) ──
    const GRACE = TUNING.push.visualGraceMs;
    // 정지(백그라운드) 고스트는 밀기·밟기·서기 판정에서 제외 = 충돌 통과 (B)
    const ghostViews = [...this.players.values()].filter((v) => !v.stale);
    // 판정 = 화면과 동일한 "지연 보간 위치"(g.x/g.y). 보는 대로 맞음 + 과거 실제 위치라 뚫기 없음
    const ghosts = ghostViews.map((v) => ({
      x: v.ghost.x, y: v.ghost.y, w: v.w, h: v.h, vy: v.ghost.lastVy, pound: v.pound,
    }));
    // 유예 감쇠: 접촉이 순간 끊겨도 GRACE 동안 연출 유지 (깜빡임 방지)
    for (const v of ghostViews) {
      v.fxLeftMs = Math.max(0, v.fxLeftMs - FIXED_MS);
      if (v.fxLeftMs <= 0) setSquash(v.squash, "none");
    }
    this.selfFx.left = Math.max(0, this.selfFx.left - FIXED_MS);
    // 밀기 판정 사전 계산 — fix1: iPush(내 입력)는 즉시, ghostPush(relay 속도)는 노이즈라 스무딩
    const RATIO = TUNING.push.squeezeRatio;
    const pushInfo = ghosts.map((g, i) => {
      const v = ghostViews[i];
      const dirToGhost = g.x >= b.x ? 1 : -1;
      const contact = Math.abs(g.x - b.x) < (g.w + b.w) / 2 + TUNING.push.contactPad
        && g.y > b.y - b.h && g.y - g.h < b.y;
      const iPush = (input.right && dirToGhost === 1) || (input.left && dirToGhost === -1);
      const ghostPushInst = Math.abs(v.ghost.lastVx) > TUNING.push.velThreshold
        && Math.sign(v.ghost.lastVx) === -dirToGhost;
      if (ghostPushInst) v.ghostPushLeftMs = GRACE;
      else v.ghostPushLeftMs = Math.max(0, v.ghostPushLeftMs - FIXED_MS);
      return { dirToGhost, contact, iPush, ghostPush: v.ghostPushLeftMs > 0 };
    });
    // 밀기: 겹친 만큼 내 몸만 소프트 상한으로 빠져나옴(원본). 밀기는 겹침 기반(상대 클라가 처리)
    pushSelfOut(b, ghosts);
    const pounding = this.me.pound !== 0;
    const stompedIdx = checkIStomped(this.me, ghosts, TUNING, pounding, prevBottomY);
    if (stompedIdx >= 0) {
      this.me.fx.add("stompedOther");
      setSquash(ghostViews[stompedIdx].squash, "stomped");   // 밟힌 상대 찌부 (내 화면)
      ghostViews[stompedIdx].fxLeftMs = GRACE;
      feedback.headstompAttacker(this, ghosts[stompedIdx].x, ghosts[stompedIdx].y);
      if (this.me.pound !== 0) {
        // B: 내려찍기로 플레이어 밟음 → 큰 바운스 + 내려찍기 종료 (강화점프 창은 checkIStomped가 이미 설정)
        b.vy = TUNING.stomp.poundBounceVelocity;
        this.me.pound = 0;
      }
    }
    const stompedMe = checkStompedMe(this.me, ghosts);
    if (stompedMe) feedback.headstompVictim(this, b.x, b.y);
    headStand(b, ghosts);
    // 아래→위 충돌: 상승 중 상대 몸 밑면에 머리 박음 = 천장 판정(마리오식) → 상승 취소 + 천장 연출
    if (b.vy < 0) {
      const headY = b.y - b.h;
      for (const g of ghosts) {
        const hOv = Math.min(b.x + b.w / 2, g.x + g.w / 2) - Math.max(b.x - b.w / 2, g.x - g.w / 2);
        if (hOv <= b.w * 0.3) continue;
        if (headY <= g.y && headY >= g.y - TUNING.stomp.headBandPx) {
          b.vy = 0; b.y = g.y + b.h;      // 머리를 상대 밑면에 붙이고 상승 정지
          this.me.fx.add("ceilBonk");
          break;
        }
      }
    }
    // 밀기 연출 (§26): 밀리는 쪽=squeeze(접촉면 찌부), 미는 쪽=shift. iPush 즉시/ghostPush 스무딩(fix1)
    for (let i = 0; i < ghosts.length; i++) {
      const g = ghosts[i];
      const v = ghostViews[i];
      const { contact, iPush, ghostPush, dirToGhost: dir } = pushInfo[i];
      if (!contact || (!iPush && !ghostPush)) continue;
      if (iPush && ghostPush) {
        // 맞밀기: 양쪽에서 눌림 → 중앙 대칭 찌부(폭 0 → offset 0). 나·상대 둘 다
        setSquash(v.squash, "squeeze", dir, RATIO, 0);
        v.fxLeftMs = GRACE;
        this.selfFx = { kind: "squeeze", dir: -dir, amt: RATIO, left: GRACE, centered: true };
      } else if (iPush) {
        setSquash(v.squash, "squeeze", dir, RATIO, g.w);   // 상대=접촉면 찌부
        v.fxLeftMs = GRACE;
        this.selfFx = { kind: "shift", dir, amt: g.w * RATIO, left: GRACE, centered: false };  // 나=파고드는 shift
      } else {   // ghostPush
        setSquash(v.squash, "shift", -dir, b.w * RATIO);   // 상대=shift
        v.fxLeftMs = GRACE;
        this.selfFx = { kind: "squeeze", dir: -dir, amt: RATIO, left: GRACE, centered: false };  // 나=접촉면 찌부
      }
    }
    // 자기 스프라이트 연출 (우선순위: 밟힘 > 천장 > shift 유예)
    if (stompedMe) { this.selfFx = { kind: "stomped", dir: 1, amt: 0, left: GRACE, centered: false }; }
    else if (this.me.fx.has("ceilBonk")) {
      this.selfFx = { kind: "ceil", dir: 1, amt: 0, left: GRACE, centered: false };
      feedback.ceilBonk(this, b.x, b.y - b.h);
    }
    if (this.selfFx.left > 0) {
      if (this.selfFx.kind === "shift") setSquash(this.mySquash, "shift", this.selfFx.dir, this.selfFx.amt);
      else if (this.selfFx.kind === "squeeze") setSquash(this.mySquash, "squeeze", this.selfFx.dir, this.selfFx.amt || TUNING.push.squeezeRatio, this.selfFx.centered ? 0 : b.w);
      else setSquash(this.mySquash, this.selfFx.kind === "none" ? "none" : this.selfFx.kind);
    } else {
      setSquash(this.mySquash, "none");
    }

    // ── 몬스터: 자기 화면 판정 ──
    for (const v of this.monsters.values()) setSquash(v.squash, "none");
    this.room.state.monsters.forEach((m: MonsterNet, id: string) => {
      const effHits = this.monEffHits(id, m.hitCount);
      if (!m.alive || m.hidden || effHits >= m.hp) return;   // 로컬 확정 사망도 즉시 제외
      if (this.room.state.serverTime < m.graceEndsAt) return;   // 재생성 유예 중엔 접촉·타격 상호작용 없음
      const v = this.monsters.get(id);
      const mx = v ? v.ghost.x : m.x, my = v ? v.ghost.y : m.y;   // 판정=화면과 동일한 지연 보간 위치
      // 밟기 가로 판정만 확대(일반 ×reachH, 내려찍기 ×poundReachH), 데미지 히트박스는 기본 폭. 세로 불변
      const hMult = prevPound === 2 ? TUNING.stomp.poundReachH : TUNING.stomp.reachH;
      const halfWs = (b.w * hMult) / 2;
      const hOvStomp = Math.min(b.x + halfWs, mx + m.w / 2) - Math.max(b.x - halfWs, mx - m.w / 2);
      const hOvBase = Math.min(b.x + b.w / 2, mx + m.w / 2) - Math.max(b.x - b.w / 2, mx - m.w / 2);
      const vOv = Math.min(b.y, my) - Math.max(b.y - b.h, my - m.h);
      if (hOvStomp <= 0 || vOv <= 0) return;
      // A: 위에서 내려오면 확실히 밟기(데미지 없음). fromAbove(현재 상반부) OR 스윕(직전엔 머리 위, 지금 통과)
      const descending = prevVy > 0 || prevPound === 2;
      const monsterTop = my - m.h;
      const fromAbove = b.y <= my - m.h * 0.5;
      const crossed = prevBottomY <= monsterTop && b.y >= monsterTop;  // 빠른 낙하 터널링도 잡음
      if (descending && (fromAbove || crossed)) {
        const willKill = effHits + 1 >= m.hp;
        this.localMonHits.set(id, { count: effHits + 1, at: this.time.now });   // 로컬 즉시 확정
        this.room.send("hitMonster", { monsterId: id, hitId: `h${this.monsterHitSeq++}` });
        if (v) setSquash(v.squash, "stomped");
        feedback.stomp(this, mx, my);
        if (prevPound === 2 && willKill) {
          // 내려찍기로 죽임 → 원작대로 튕김 없이 flatten(pound가 계속 내려감)
        } else if (prevPound === 2) {
          // B2: 내려찍었는데 안 죽음 → 큰 바운스 + 강화점프 창 + 내려찍기 종료 (스핀 없음)
          b.vy = TUNING.stomp.poundBounceVelocity;
          this.me.stompComboLeftMs = TUNING.stomp.jumpWindowMs;
          this.me.pound = 0;
        } else {
          // 일반 밟기 → 튕김 + 강화점프 창
          b.vy = TUNING.stomp.bounceVelocity;
          this.me.stompComboLeftMs = TUNING.stomp.jumpWindowMs;
        }
      } else if (hOvBase > 0 && this.me.slide) {
        // 경사 슬라이드로 접촉 → 처치(원작 Slide Attack), 접촉 데미지 무적(발사체는 별개)
        this.localMonHits.set(id, { count: effHits + 1, at: this.time.now });
        this.room.send("hitMonster", { monsterId: id, hitId: `h${this.monsterHitSeq++}` });
        if (v) setSquash(v.squash, "stomped");
      } else if (hOvBase > 0 && this.me.invincibleLeftMs > 0) {
        this.localMonHits.set(id, { count: effHits + 1, at: this.time.now });
        this.room.send("hitMonster", { monsterId: id, hitId: `h${this.monsterHitSeq++}` });
      } else if (hOvBase > 0) {
        // 데미지는 기본 폭 겹침일 때만. 방금 밟은 몬스터면 튕겨 분리되는 짧은 창엔 무시(재접촉 방지)
        const e = this.localMonHits.get(id);
        if (e && this.time.now - e.at < 400) return;
        this.takeHit(); // 접촉 피해 = 자기 클라 확정
      }
    });

    // ── 발사체 피격 (자책 방지 §30-1) ──
    this.room.state.projectiles.forEach((pr: ProjNet, _id: string) => {
      if (pr.ownerId === this.room.sessionId && this.carry.selfIgnoreLeftMs > 0) return;
      const hOv = Math.abs(pr.x - b.x) < (TUNING.sizes.projectile + b.w) / 2;
      const vOv = pr.y > b.y - b.h && pr.y - TUNING.sizes.projectile < b.y;
      if (hOv && vOv && this.me.invincibleLeftMs <= 0) {
        if (pr.effect === "knockback") { b.vx = Math.sign(b.x - pr.x) * TUNING.item.knockbackVx; b.vy = TUNING.item.knockbackVy; }
        else this.takeHit();
      }
    });

    // ── 블록 상호작용: 머리치기/내려찍기 파괴·물음표·물성 ──
    this.room.state.blocks.forEach((bs: BlockNet, id: string) => {
      const spec = TESTMAP.blocks.find((bl) => bl.id === id);
      if (!spec || !bs.active || !bs.visibleNow) return;
      const g = this.blockGhosts.get(id);   // 상호작용도 보간 위치로 (충돌과 일치)
      const bx = g ? g.x : bs.x, by = g ? g.y : bs.y;
      const r = blockRect({ spec, x: bx, y: by, state: "active", respawnLeftMs: 0, graceLeftMs: 0, emptied: bs.emptied, mem: {} });
      const withinX = Math.abs(b.x - (r.x + r.w / 2)) < (b.w + r.w) / 2;
      const headAt = b.y - b.h;
      const bonkHead = withinX && prevVy < 0 && Math.abs(headAt - (r.y + r.h)) < 10;
      const poundOn = withinX && prevPound === 2 && Math.abs(b.y - r.y) < 12;
      if (bonkHead) {
        if (spec.emitsItem && !bs.emptied) this.room.send("hitQBlock", { blockId: id });
        else if (spec.breakBy?.headbutt) this.room.send("breakBlock", { blockId: id, by: "headbutt" });
      }
      if (poundOn && spec.breakBy?.pound) this.room.send("breakBlock", { blockId: id, by: "pound" });
      // 물성 (당하는 쪽 로컬 적용 §properties)
      if (spec.properties) {
        const touching = withinX && b.y >= r.y - 2 && b.y - b.h <= r.y + r.h + 2;
        const standing = withinX && Math.abs(b.y - r.y) < 4 && b.grounded;
        for (const propSpec of spec.properties) {
          const impl = getProperty(propSpec.type);
          if (!impl) continue;
          if (standing && impl.onStand) impl.onStand(b, TUNING, propSpec);
          if (touching && impl.onTouch) {
            const side = standing ? "top" : bonkHead ? "bottom" : b.x < r.x + r.w / 2 ? "right" : "left";
            if (propSpec.type === "trampoline" && side === "top") feedback.spring(this, r.x + r.w / 2, r.y);
            impl.onTouch(b, r, side, TUNING, propSpec);
          }
        }
      }
    });
    // 물성 부수효과 플래그 소비
    const flags = b as unknown as { __takeDamage?: boolean; __die?: boolean; __toggleSwitch?: boolean };
    if (flags.__toggleSwitch) { this.room.send("toggleSwitch", {}); flags.__toggleSwitch = false; feedback.toggleSwitch(this, this.me.body.x, this.me.body.y); }
    if (flags.__die) { flags.__die = false; this.die(); }
    if (flags.__takeDamage) { flags.__takeDamage = false; this.takeHit(); }

    // ── 아이템 접촉 → 서버 경합 (§60) ──
    this.room.state.items.forEach((it: ItemNet, id: string) => {
      if (!it.available) return;
      if (Math.abs(it.x - b.x) < (TUNING.sizes.item + b.w) / 2 && Math.abs(it.y - b.y) < b.h) {
        this.room.send("claimItem", { itemId: id });
      }
    });

    // ── 잡기 (§30): 로컬 즉시 잡기 + 서버 소유권 통지 ──
    const carryables: Carryable[] = [];
    this.room.state.carryables.forEach((c: CarryNet, id: string) => {
      if (!c.alive) return;
      const cb = { x: c.x, y: c.y, vx: 0, vy: 0, w: TUNING.sizes.carryable, h: TUNING.sizes.carryable, grounded: true, facing: 1 as const, touchingWall: 0 as const, onSlopeDir: 0 as const, gravity: true, tags: [] };
      carryables.push({ id, body: cb, grabbable: true, heldBy: c.heldBy || null });
    });
    const ev = stepCarry(this.carry, this.me, input, carryables);
    if (ev.kind === "grabMiss") { this.grabHighlightUntil = now + 800; feedback.grabDenied(this, b.x, b.y); }
    else if (ev.kind === "grab" && ev.id) { this.room.send("grabObj", { objId: ev.id }); feedback.grab(this, b.x, b.y); }
    else if (ev.kind === "throw" && ev.id) {
      this.room.send("throwObj", {
        objId: ev.id,
        x: b.x + b.facing * (b.w / 2 + TUNING.sizes.handOffset), y: b.y - b.h * 0.5,
        vx: ev.vx ?? 0, vy: ev.vy ?? 0,
      });
      playSound("throw", { x: b.x, y: b.y });
    }

    // ── 압사 (§35-L) ──
    if (b.crushed && this.me.freezeLeftMs <= 0) this.die();

    // ── 사운드: 자기 이벤트 플래그 (avatar.ts a.fx) ──
    if (this.me.fx.has("wallJump")) feedback.wallKick(this, b.x, b.y);

    // ── 상태 송신 (relay) ──
    this.sendAcc += FIXED_MS;
    if (this.sendAcc >= 1000 / TUNING.net.sendRateHz) {
      this.sendAcc = 0;
      sendAvatarState(this.room, this.me, this.tick, this.dead);
    }
    this.me.fx.clear();
  }

  takeHit(): void {
    if (this.me.invincibleLeftMs > 0 || this.me.freezeLeftMs > 0) return;
    this.me.hp -= 1;
    this.me.invincibleLeftMs = 1500; // 피격 무적 (마리오식)
    if (this.me.hp <= 0) this.die();
    else feedback.hurt(this, this.me.body.x, this.me.body.y);
  }

  die(): void {
    this.dead = true;
    this.deadUntil = this.time.now + 1200;
    clearItemEffects(this.me);       // (라인 이탈과 동일하게 정리 — 단일 라인 테스트맵)
    this.myRect.setVisible(false);
    feedback.die(this, this.me.body.x, this.me.body.y);
    // dead 중엔 fixedTick의 주기 relay가 통째로 스킵되므로(§261), 전이 즉시 1회 명시 전송
    sendAvatarState(this.room, this.me, this.tick, true);
  }

  respawn(): void {
    this.dead = false;
    this.me = createAvatar(TESTMAP.spawn.x, TESTMAP.spawn.y, TUNING.sizes.playerHeight);
    this.me.hp = 1;
    this.myRect.setVisible(true);
  }

  render(delta: number): void {
    if (!this.stateReady()) return;   // 첫 상태 도착 전 스킵 (§28)
    const b = this.me.body;
    stepSquash(this.mySquash);
    this.myRect.setSize(b.w, b.h);
    this.myRect.setScale(this.mySquash.sx, this.mySquash.sy);
    this.myRect.setPosition(b.x + this.mySquash.offsetX, b.y + this.mySquash.offsetY);
    // 무적=노랑 / 내려찍기·공중스핀=주황(애니메이션 없어 구별용) / 평상=파랑
    this.myRect.fillColor = this.me.invincibleLeftMs > 0 ? 0xffee55
      : this.me.pound !== 0 ? 0xffcc33 : 0x4488ff;
    // 무적(피격 직후·부활 직후 공용) 동안 점멸 — 부활 즉시 죽는 것 방지 유예를 시각으로도 표시
    this.myRect.setAlpha(this.me.invincibleLeftMs > 0 ? flickerAlpha(this.time.now) : 1);
    // 오디오 리스너 = 로컬 플레이어 위치 (거리감쇠·좌우팬 기준점)
    setListenerPosition(b.x, b.y);
    // 고스트 플레이어
    this.room.state.players.forEach((p: PlayerNet, id: string) => {
      if (id === this.room.sessionId) return;
      const v = this.players.get(id);
      if (!v) return;
      // 정지 감지 (B): tick이 staleMs 동안 안 오르면 = 탭 백그라운드 → 충돌 통과 대상
      const nowMs = this.time.now;
      if (p.tick !== v.lastTick) {
        v.lastTick = p.tick; v.lastTickAt = nowMs; v.stale = false;
        ghostSnapshot(v.ghost, nowMs, p.x, p.y, p.vx, p.vy);   // 새 패치 = 스냅샷 push
      } else if (nowMs - v.lastTickAt > TUNING.net.staleMs) v.stale = true;
      ghostRenderAt(v.ghost, nowMs - TUNING.net.interpDelayMs);   // 지연 시점 보간(예측 X)
      stepSquash(v.squash);
      v.w = p.w; v.h = p.h; v.pound = p.pound;
      v.rect.setSize(p.w, p.h);
      v.rect.setScale(v.squash.sx, v.squash.sy);
      v.rect.setPosition(v.ghost.x + v.squash.offsetX, v.ghost.y + v.squash.offsetY);   // 찌부/shift 앵커 적용(내 몸과 동일)
      // 정지 = 반투명(통과 중), 무적(피격/부활 유예)이면 점멸 — 둘 다 아니면 불투명
      v.rect.setAlpha(v.stale ? 0.35 : p.invincible ? flickerAlpha(nowMs) : 1);
      v.label.setPosition(v.ghost.x, v.ghost.y - p.h - 4);
      // ── 사운드: 다른 플레이어 전이 감지 (PlayerState 필드만으로 재현 — listener.ts가 거리감쇠 적용) ──
      if (v.stale) return; // 백그라운드 정지 중엔 소리도 쉼(B)
      const clinging = !p.grounded && p.touchingWall !== 0;
      const pfx = this.playerFx.get(id);
      if (!pfx) {
        this.playerFx.set(id, {
          grounded: p.grounded, slide: p.slide, pound: p.pound,
          clinging, dead: p.dead, invincible: p.invincible, wallJumpSeq: p.wallJumpSeq,
        });
      } else {
        if (p.dead && !pfx.dead) {
          feedback.die(this, v.ghost.x, v.ghost.y);
        } else {
          // 사망 프레임엔 착지/점프 등 다른 전이와 안 겹치게 else로 분리
          if (p.grounded && !pfx.grounded) {
            if (pfx.pound === 2 && p.pound === 0) feedback.poundLand(this, v.ghost.x, v.ghost.y);
            else feedback.land(this, v.ghost.x, v.ghost.y);
          } else if (!p.grounded && pfx.grounded && p.vy < 0) {
            feedback.jump(this, v.ghost.x, v.ghost.y);
          }
          if (p.slide && !pfx.slide) feedback.slideStart(this, v.ghost.x, v.ghost.y);
          if (!pfx.pound && p.pound === 1) playSound("slam_start", { x: v.ghost.x, y: v.ghost.y });
          if (clinging && !pfx.clinging) feedback.wallGrab(this, v.ghost.x, v.ghost.y);
          if (p.wallJumpSeq !== pfx.wallJumpSeq) feedback.wallKick(this, v.ghost.x, v.ghost.y);
          // invincible 전이 = 피격 순간(사망과 동시 발생 시 위 dead 분기가 우선 처리되어 안 겹침)
          if (p.invincible && !pfx.invincible) feedback.hurt(this, v.ghost.x, v.ghost.y);
        }
        pfx.grounded = p.grounded; pfx.slide = p.slide; pfx.pound = p.pound;
        pfx.clinging = clinging; pfx.dead = p.dead; pfx.invincible = p.invincible; pfx.wallJumpSeq = p.wallJumpSeq;
      }
    });
    // 몬스터 (dead reckoning)
    this.room.state.monsters.forEach((m: MonsterNet, id: string) => {
      const v = this.monsters.get(id);
      if (!v) return;
      if (m.x !== v.ghost.srvX || m.y !== v.ghost.srvY) ghostSnapshot(v.ghost, this.time.now, m.x, m.y, m.vx, m.vy); // 새 패치 = 스냅샷
      ghostRenderAt(v.ghost, this.time.now - TUNING.net.interpDelayMs);   // 지연 시점 보간(예측 X)
      stepSquash(v.squash);
      const visible = m.alive && !m.hidden && this.monEffHits(id, m.hitCount) < m.hp;   // 로컬 확정 사망 즉시 숨김
      v.rect.setVisible(visible); v.label.setVisible(visible);
      v.rect.setPosition(v.ghost.x + v.squash.offsetX, v.ghost.y + v.squash.offsetY);
      v.rect.setScale(v.squash.sx, v.squash.sy);
      v.rect.fillColor = m.stunned ? 0x999999 : m.windupAnim ? 0xff8888 : 0xcc66ff;
      // 재생성 유예(무적) 동안 점멸 — 상호작용 없음을 시각으로 알림
      v.rect.setAlpha(this.room.state.serverTime < m.graceEndsAt ? flickerAlpha(this.time.now) : 1);
      v.label.setPosition(v.ghost.x, v.ghost.y - m.h - 4);
      // ── 사운드/이펙트: MonsterState 전이 감지 (서버 emit이 클라로 직접 안 와서 상태값으로 엣지 검출) ──
      const prevFx = this.monsterFx.get(id);
      if (!prevFx) {
        this.monsterFx.set(id, { alive: m.alive, stunned: m.stunned, hidden: m.hidden, action: m.currentAction });
      } else {
        if (prevFx.alive && !m.alive) feedback.monsterDie(this, v.ghost.x, v.ghost.y);
        else if (!prevFx.alive && m.alive) feedback.monsterRespawn(this, v.ghost.x, v.ghost.y);
        if (!prevFx.stunned && m.stunned) feedback.monsterStunned(this, v.ghost.x, v.ghost.y);
        if (prevFx.hidden && !m.hidden) feedback.monsterEmerge(this, v.ghost.x, v.ghost.y);
        if (prevFx.action !== m.currentAction) monsterPatternChanged(this, m.currentAction, v.ghost.x, v.ghost.y);
        prevFx.alive = m.alive; prevFx.stunned = m.stunned; prevFx.hidden = m.hidden; prevFx.action = m.currentAction;
      }
    });
    // 발사체·아이템·블록 (발사체는 dead reckoning, 피격 판정은 서버 좌표 유지)
    this.room.state.projectiles.forEach((pr: ProjNet, id: string) => {
      const rr = this.projectiles.get(id);
      if (!rr) return;
      let g = this.projGhosts.get(id);
      if (!g) { g = createGhostView(pr.x, pr.y); this.projGhosts.set(id, g); }
      if (pr.x !== g.srvX || pr.y !== g.srvY) ghostServerUpdate(g, pr.x, pr.y, pr.vx, pr.vy);
      ghostStep(g, delta);
      rr.setPosition(g.x, g.y);
    });
    this.room.state.items.forEach((it: ItemNet, id: string) => {
      const r = this.itemRects.get(id);
      if (r) {
        r.setVisible(it.available);
        r.setPosition(it.x, it.y);
        // 아이템 = 노란 발광 테두리(§1.2, 항상 표시). 잡기 하이라이트는 더 두껍게 덮어씀.
        if (this.grabHighlightUntil > this.time.now) r.setStrokeStyle(3, 0xffff00);
        else r.setStrokeStyle(2, 0xffee55, 0.85);
      }
    });
    // 잡기 파츠 렌더 (내가 든 것은 로컬 핀 §30-2, 남이 든 것은 서버 추종)
    this.room.state.carryables.forEach((c: CarryNet, id: string) => {
      const r = this.carryRects.get(id);
      if (!r) return;
      if (!r.visible && c.alive) feedback.objectRespawn(this, c.x, c.y);   // 재생성 전이 감지(§45)
      r.setVisible(c.alive);
      if (!c.alive) { this.carryGhosts.delete(id); return; }   // 재생성 시 순간이동 방지(다시 생성)
      if (this.carry.heldId === id) {
        r.setPosition(b.x + b.facing * (b.w / 2 + TUNING.sizes.handOffset), b.y - b.h * 0.3);
      } else {
        let g = this.carryGhosts.get(id);
        if (!g) { g = createGhostView(c.x, c.y); this.carryGhosts.set(id, g); }
        ghostServerUpdate(g, c.x, c.y, 0, 0);   // 속도 없음 → 순수 lerp 수렴
        ghostStep(g, delta);
        r.setPosition(g.x, g.y);
      }
      if (this.grabHighlightUntil > this.time.now && !c.heldBy) r.setStrokeStyle(3, 0xffff00);
      else r.setStrokeStyle();
    });
    // 손 연출 (§30-3): 기본 손 + 캐릭터색 틴트 + 스프링(늦게 따라옴)
    if (this.carry.heldId) {
      const hx = b.x + b.facing * (b.w / 2 + TUNING.sizes.handOffset);
      const hy = b.y - b.h * 0.3;
      this.handRect.setVisible(true);
      this.handRect.x += (hx - this.handRect.x) * TUNING.carry.handLerp;
      this.handRect.y += (hy - this.handRect.y) * TUNING.carry.handLerp;
      this.handRect.fillColor = 0xcfe0ff;   // 캐릭터(파랑) 기반 밝은 틴트
    } else {
      this.handRect.setVisible(false);
    }
    this.room.state.blocks.forEach((bs: BlockNet, id: string) => {
      const r = this.blockRects.get(id);
      if (!r) return;
      // reappearing 동안은 비충돌이지만(§상호작용은 active 게이트로 이미 배제) 화면엔 점멸로 보여준다.
      r.setVisible((bs.active && bs.visibleNow) || bs.reappearing);
      r.setAlpha(bs.reappearing ? flickerAlpha(this.time.now) : 1);
      const g = this.blockGhosts.get(id);   // 충돌과 동일한 보간 위치
      r.setPosition(g ? g.x : bs.x, g ? g.y : bs.y);
      r.fillColor = bs.emptied ? 0x555555 : 0x8888aa;
    });
    this.drawVisualLanguage();
    this.renderServerview();
  }

  /**
   * 시각 언어 오버레이(§1 항상 표시분) — deriveVisualTagsFromSpec으로 면별 테두리를 매 프레임 다시 그린다.
   * 스펙은 TESTMAP에서 id로 조회(런타임 스폰 몬스터 등 TESTMAP 밖 엔티티는 스펙이 없어 테두리 생략).
   */
  private drawVisualLanguage(): void {
    const ground = this.visualGfx;
    const entities = this.entityVisualGfx;
    ground.clear();
    entities.clear();
    const iAmInvincible = this.me.invincibleLeftMs > 0;

    // ── 지형 레이어(ground, 엔티티보다 아래) ──────────────────────────────
    // 정적 지형 + 살아있는 직사각형 블록을 한 목록으로 모아 이음선 병합(1×1 타일 이어붙임 대응).
    const seamRects: SeamRect[] = [];
    for (const r of TESTMAP.terrain.solids) {
      const f = facesOf(r);
      seamRects.push({
        left: r.x, top: r.y, w: r.w, h: r.h,
        faces: {
          top: f.top ? "solidWhite" : "dashed", bottom: f.bottom ? "solidWhite" : "dashed",
          left: f.left ? "solidWhite" : "dashed", right: f.right ? "solidWhite" : "dashed",
        },
      });
    }
    const switchOverlays: Array<() => void> = [];
    this.room.state.blocks.forEach((bs: BlockNet, id: string) => {
      if (!bs.active || !bs.visibleNow) return;
      const spec = TESTMAP.blocks.find((bl) => bl.id === id);
      if (!spec) return;
      const g = this.blockGhosts.get(id);
      const left = g ? g.x : bs.x, top = g ? g.y : bs.y;
      const tags = blockVisualTagsFromSpec(spec);
      if (tags.faces && (!spec.shape || spec.shape === "rect")) {
        seamRects.push({ left, top, w: spec.w, h: spec.h, faces: tags.faces });
      }
      if (tags.auras.includes("switchToggler")) {
        switchOverlays.push(() => drawSwitchTogglerBorder(ground, left, top, spec.w, spec.h, this.room.state.switchOn, this.time.now));
      } else if (tags.auras.includes("switchAffected") && spec.switchReact) {
        const whenOn = spec.switchReact.whenOn;
        switchOverlays.push(() => drawSwitchAffectedBorder(ground, left, top, spec.w, spec.h, whenOn, this.room.state.switchOn));
      }
    });
    drawSeamMergedBorders(ground, seamRects);
    for (const s of TESTMAP.terrain.slopes) drawSlopeBorder(ground, s);
    for (const draw of switchOverlays) draw();

    // ── 엔티티 레이어(entities, 자기 몸 위 — 병합 없이 항상 통짜로) ──────────
    // squash(벽 찌부·밀림 등 연출) 반영 — 시각 사각형이 움직이면 테두리도 같이 움직여야 함(피드백 2026-07-15).
    drawPlayerBorder(entities, squashedBox(this.me.body.x, this.me.body.y, this.me.body.w, this.me.body.h, this.mySquash), true);
    this.room.state.players.forEach((p: PlayerNet, id: string) => {
      if (id === this.room.sessionId || p.dead) return;
      const v = this.players.get(id);
      if (!v || v.stale) return;
      drawPlayerBorder(entities, squashedBox(v.ghost.x, v.ghost.y, p.w, p.h, v.squash), false);
    });
    this.room.state.monsters.forEach((m: MonsterNet, id: string) => {
      const visible = m.alive && !m.hidden && this.monEffHits(id, m.hitCount) < m.hp;
      if (!visible || this.room.state.serverTime < m.graceEndsAt) return;   // 재생성 유예 중엔 위험 표시 생략(점멸이 대신 알림)
      const spec = TESTMAP.monsters.find((ms) => ms.id === id);
      if (!spec) return;   // 콘솔 spawnmonster 등 테스트맵 밖 엔티티는 스펙이 없어 테두리 생략
      const v = this.monsters.get(id);
      const mx = v ? v.ghost.x : m.x, my = v ? v.ghost.y : m.y;
      const box = squashedBox(mx, my, m.w, m.h, v ? v.squash : { sx: 1, sy: 1, offsetX: 0, offsetY: 0 });
      const tags = monsterVisualTagsFromSpec(spec);
      if (tags.faces) drawFaceBorders(entities, box.left, box.top, box.w, box.h, tags.faces, iAmInvincible);
    });
  }

  /** serverview (§19): 옵션1 스프라이트박스 / 2 히트박스 / 3 서버수신 상태 */
  renderServerview(): void {
    this.debugGfx.clear();
    if (this.svOpts.size === 0) return;
    const showPlayer = this.svSubject === "all" || this.svSubject === "player";
    const showTerrain = this.svSubject === "all" || this.svSubject === "terrain";
    const showMonster = this.svSubject === "all" || this.svSubject === "monster";
    if (this.svOpts.has(2)) {
      this.debugGfx.lineStyle(2, 0x4488ff, 1);
      if (showPlayer) {
        const b = this.me.body;
        this.debugGfx.strokeRect(b.x - b.w / 2, b.y - b.h, b.w, b.h);
      }
      if (showTerrain) {
        this.debugGfx.lineStyle(1, 0x33ff77, 0.7);
        for (const s of this.currentTerrain().solids) this.debugGfx.strokeRect(s.x, s.y, s.w, s.h);
      }
      if (showMonster) {
        this.debugGfx.lineStyle(2, 0xcc66ff, 1);
        this.room.state.monsters.forEach((m: MonsterNet) => {
          if (m.alive) this.debugGfx.strokeRect(m.x - m.w / 2, m.y - m.h, m.w, m.h);
        });
      }
    }
    if (this.svOpts.has(1) && showPlayer) {
      this.debugGfx.fillStyle(0xffffff, 0.12);
      const r = this.myRect;
      this.debugGfx.fillRect(r.x - (r.width * r.scaleX) / 2, r.y - r.height * r.scaleY, r.width * r.scaleX, r.height * r.scaleY);
    }
    if (this.svOpts.has(3)) {
      this.room.state.players.forEach((p: PlayerNet, id: string) => {
        const mine = id === this.room.sessionId;
        this.debugGfx.lineStyle(2, mine ? 0x00e5e5 : 0x7CFC00, 1);   // 청록=내것, 연두=남 (§19-2)
        this.debugGfx.strokeRect(p.x - p.w / 2, p.y - p.h, p.w, p.h);
      });
    }
  }
}

// ── 네트 상태 타입 (schema 미러 — any 회피용 최소 형태) ──
interface PlayerNet { x: number; y: number; vx: number; vy: number; w: number; h: number; facing: number; nickname: string; tick: number; pound: number; slide: boolean; grounded: boolean; touchingWall: number; dead: boolean; wallJumpSeq: number; invincible: boolean }
interface MonsterNet { asset: string; x: number; y: number; vx: number; vy: number; w: number; h: number; alive: boolean; stunned: boolean; hidden: boolean; hitCount: number; hp: number; windupAnim: string; windupEndsAt: number; currentAction: string; graceEndsAt: number }
interface BlockNet { x: number; y: number; vx: number; vy: number; active: boolean; emptied: boolean; visibleNow: boolean; reappearing: boolean }
interface ItemNet { kind: string; x: number; y: number; available: boolean }
interface CarryNet { x: number; y: number; alive: boolean; heldBy: string }
interface ProjNet { asset: string; x: number; y: number; vx: number; vy: number; effect: string; ownerId: string }
