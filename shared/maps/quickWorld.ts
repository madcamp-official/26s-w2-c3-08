// 간이 레이스(?quick, startstart) 전용 월드 — TESTMAP과 동일 방식(BlockSpec/MonsterSpec 리터럴 직접 작성,
// DB/에셋/attrs 파이프라인 전혀 안 씀 — 시드 실패·에셋 크기 버그 등 변수 제거, 2026-07-16).
// SOLID_ALL 등은 shared/physics 재사용, faces만 직접 명시. mergeLines()가 만드는 MergedMap과 같은 모양이라
// RaceRoom·RaceScreen 코드는 그대로 두고 quickMode에서 이 객체를 바로 this.merged로 쓰면 된다.
import { TUNING } from "../physics/tuning.js";
import { SOLID_ALL, SOLID_TOP } from "../physics/terrain.js";
import type { MergedMap } from "../build/mergeLines.js";
import type { BlockSpec } from "../parts/block.js";
import type { MonsterSpec } from "../parts/monster.js";

const T = TUNING.world.tileSize;

const blocks: BlockSpec[] = [
  // ── 구간1(0~20타일) 쉬움 — 바닥 연속 + 스위치/반응 블록(막지 않음) ──
  { id: "floor", x: 0, y: 18 * T, w: 58 * T, h: 2 * T, faces: SOLID_ALL },
  { id: "sw1", x: 3 * T, y: 17 * T, w: T, h: T, faces: SOLID_ALL, properties: [{ type: "switchToggle" }] },
  { id: "gate1", x: 12 * T, y: 16 * T, w: 2 * T, h: T, faces: SOLID_ALL, switchReact: { mode: "show", whenOn: true } },

  // ── 구간2(20~57타일) 어려움 — 계단식 점프 2세트(바닥 연속이라 추락사 없음) ──
  { id: "p1", x: 24 * T, y: 17 * T, w: 3 * T, h: T, faces: SOLID_TOP },
  { id: "p2", x: 26 * T, y: 16 * T, w: 3 * T, h: T, faces: SOLID_TOP },
  { id: "p3", x: 28 * T, y: 15 * T, w: 3 * T, h: T, faces: SOLID_TOP },
  { id: "p4", x: 31 * T, y: 15 * T, w: 3 * T, h: T, faces: SOLID_TOP },
  { id: "p5", x: 33 * T, y: 14 * T, w: 3 * T, h: T, faces: SOLID_TOP },
  { id: "p6", x: 35 * T, y: 13 * T, w: 3 * T, h: T, faces: SOLID_TOP },

  // 가시열 + 중앙 스프링
  { id: "sp1", x: 40 * T, y: 17 * T, w: T, h: T, faces: { top: false, bottom: false, left: false, right: false }, properties: [{ type: "damage", part: "notTop" }] },
  { id: "sp2", x: 41 * T, y: 17 * T, w: T, h: T, faces: { top: false, bottom: false, left: false, right: false }, properties: [{ type: "damage", part: "notTop" }] },
  { id: "sp3", x: 42 * T, y: 17 * T, w: T, h: T, faces: { top: false, bottom: false, left: false, right: false }, properties: [{ type: "damage", part: "notTop" }] },
  { id: "sp4", x: 43 * T, y: 17 * T, w: T, h: T, faces: { top: false, bottom: false, left: false, right: false }, properties: [{ type: "damage", part: "notTop" }] },
  { id: "spring1", x: 44 * T, y: 17 * T, w: T, h: T, faces: SOLID_ALL, properties: [{ type: "trampoline", power: 1200 }] },
  { id: "sp5", x: 45 * T, y: 17 * T, w: T, h: T, faces: { top: false, bottom: false, left: false, right: false }, properties: [{ type: "damage", part: "notTop" }] },
  { id: "sp6", x: 46 * T, y: 17 * T, w: T, h: T, faces: { top: false, bottom: false, left: false, right: false }, properties: [{ type: "damage", part: "notTop" }] },
  { id: "sp7", x: 47 * T, y: 17 * T, w: T, h: T, faces: { top: false, bottom: false, left: false, right: false }, properties: [{ type: "damage", part: "notTop" }] },
  { id: "sp8", x: 48 * T, y: 17 * T, w: T, h: T, faces: { top: false, bottom: false, left: false, right: false }, properties: [{ type: "damage", part: "notTop" }] },

  // 벽타기 샤프트 — 기둥 꼭대기가 물음표 블록(거대화)
  { id: "wl", x: 50 * T, y: 12 * T, w: T, h: 6 * T, faces: SOLID_ALL },
  { id: "qb1", x: 50 * T, y: 11 * T, w: T, h: T, faces: SOLID_ALL, breakBy: {}, emitsItem: { assets: ["giant"], random: false } },
  { id: "wr", x: 52 * T, y: 12 * T, w: T, h: 6 * T, faces: SOLID_ALL },
  { id: "qb2", x: 52 * T, y: 11 * T, w: T, h: T, faces: SOLID_ALL, breakBy: {}, emitsItem: { assets: ["giant"], random: false } },

  // 좌우 경계벽(추락사 없음 — 그냥 못 나가게만)
  { id: "wallL", x: -T, y: 0, w: T, h: 22 * T, faces: SOLID_ALL },
  { id: "wallR", x: 58 * T, y: 0, w: T, h: 22 * T, faces: SOLID_ALL },
];

const monsters: MonsterSpec[] = [
  { id: "gm1", asset: "goomba", x: 6 * T, y: 17 * T, w: T, h: T, rules: [{ when: { type: "always" }, do: { type: "patrol", speed: "slow", turnAtLedge: false } }], vuln: { stomp: "die" }, hp: 1, contactDamage: true },
  { id: "gm2", asset: "goomba", x: 16 * T, y: 17 * T, w: T, h: T, rules: [{ when: { type: "always" }, do: { type: "patrol", speed: "slow", turnAtLedge: false } }], vuln: { stomp: "die" }, hp: 1, contactDamage: true },
  { id: "sk1", asset: "spiky", x: 9 * T, y: 17 * T, w: T, h: T, rules: [{ when: { type: "always" }, do: { type: "idle" } }], vuln: { stomp: "hurtAttacker" }, hp: 1, contactDamage: true },
];

const START_FLAG = { x: 1, y: 17 };
const GOAL_FLAG = { x: 55, y: 17 };

export const QUICK_WORLD: MergedMap = {
  worldDef: {
    terrain: { solids: [], slopes: [] },
    blocks, monsters, items: [],
    line: { startX: 0, endX: 58 * T, index: 0 },
    spawn: { x: START_FLAG.x * T + T / 2, y: (START_FLAG.y + 1) * T },
  },
  startFlagTiles: START_FLAG,
  goalFlagTiles: GOAL_FLAG,
  lineFlags: [
    { start: START_FLAG, end: { x: 18, y: 17 } },
    { start: { x: 21, y: 17 }, end: GOAL_FLAG },
  ],
  lineRanges: [
    { startX: 0, endX: 20 },
    { startX: 20, endX: 58 },
  ],
  fallY: 24 * T,
};
