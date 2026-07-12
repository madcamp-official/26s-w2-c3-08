// baseworld 테스트 맵: 지형 + 시험 파츠 배치 (라인 1개짜리)
import type { Terrain } from "../physics/terrain.js";
import { SOLID_ALL, SOLID_TOP } from "../physics/terrain.js";
import type { BlockSpec } from "../parts/block.js";
import type { MonsterSpec } from "../parts/monster.js";
import type { ItemSpec } from "../parts/item.js";
import type { LineBounds } from "../parts/world.js";

const T = 64;

export const TESTMAP = {
  width: 40 * T,   // 2560
  height: 15 * T,  // 960
  spawn: { x: 3 * T, y: 12 * T },
  line: { startX: 0, endX: 40 * T, index: 0 } satisfies LineBounds,

  terrain: {
    solids: [
      { x: 0, y: 13 * T, w: 40 * T, h: 2 * T, faces: SOLID_ALL },     // 바닥
      { x: -T, y: 0, w: T, h: 15 * T, faces: SOLID_ALL },              // 좌벽
      { x: 40 * T, y: 0, w: T, h: 15 * T, faces: SOLID_ALL },          // 우벽
      { x: 6 * T, y: 10.5 * T, w: 4 * T, h: 0.6 * T, faces: SOLID_TOP },  // 반통과 발판
      { x: 12 * T, y: 9 * T, w: 4 * T, h: T, faces: SOLID_ALL },       // 발판
      { x: 9 * T, y: 6 * T, w: T, h: 4 * T, faces: SOLID_ALL },        // 벽점프 기둥 L
      { x: 12.5 * T, y: 6 * T, w: T, h: 4 * T, faces: SOLID_ALL },     // 벽점프 기둥 R
      { x: 22 * T, y: 11 * T, w: 5 * T, h: T, faces: SOLID_ALL },      // 낮은 터널 천장
    ],
    slopes: [
      { x: 17 * T, y: 11 * T, w: 3 * T, h: 2 * T, dir: 1, kind: "floor" },   // 오르막
      { x: 28 * T, y: 11 * T, w: 4 * T, h: 2 * T, dir: -1, kind: "floor" },  // 내리막
    ],
  } as Terrain,

  blocks: [
    // 물음표 블록 (아래서 치면 아이템)
    {
      id: "q1", x: 8 * T, y: 8 * T, w: T, h: T,
      breakBy: {}, emitsItem: { assets: ["speed"], random: false },
    },
    // 파괴 블록 (내려찍기·머리치기)
    {
      id: "brk1", x: 14 * T, y: 12 * T, w: T, h: T,
      breakBy: { headbutt: true, pound: true, shell: true, explosion: true },
    },
    // 왕복 리프트 (behavior 통합 — patrol을 블록 이동으로)
    {
      id: "lift1", x: 33 * T, y: 10 * T, w: 3 * T, h: 0.6 * T,
      faces: { top: true, bottom: false, left: false, right: false },
      rules: [{ when: { type: "always" }, do: { type: "patrol", speed: "slow" } }],
    },
    // 트램펄린
    { id: "spring1", x: 25 * T, y: 12 * T, w: T, h: T, properties: [{ type: "trampoline" }] },
    // 스위치 토글 블록
    { id: "sw1", x: 5 * T, y: 12 * T, w: T, h: T, properties: [{ type: "switchToggle" }] },
    // 스위치 연동 (ON일 때 표시)
    { id: "swblk1", x: 20 * T, y: 8 * T, w: 2 * T, h: T, switchReact: { mode: "show", whenOn: true } },
  ] as BlockSpec[],

  monsters: [
    // 굼바형: 왕복 + 밟기 즉사
    {
      id: "gm1", asset: "goomba", x: 16 * T, y: 13 * T, w: T, h: T,
      rules: [{ when: { type: "always" }, do: { type: "patrol", speed: "slow", turnAtLedge: false } }],
      vuln: { stomp: "die" }, hp: 1, contactDamage: true,
    },
    // 쿵쿵형: 대기 → 아래 접근 시 낙하 (선딜) → 복귀
    {
      id: "th1", asset: "thwomp", x: 24 * T, y: 8 * T, w: 1.5 * T, h: 1.5 * T,
      rules: [
        { when: { type: "always" }, do: { type: "idle" } },
        {
          when: { type: "and", of: [{ type: "playerWithin", axis: "x", dist: "near" }, { type: "playerDirection", dir: "below" }] },
          do: { type: "slamDown" }, priority: 2, windupMs: 400,
        },
        { when: { type: "landed" }, do: { type: "returnUp" }, priority: 1 },
      ],
      vuln: { stomp: "hurtAttacker", invincible: true }, hp: 999, contactDamage: true,
    },
    // 추적형 (HP 2)
    {
      id: "ch1", asset: "chaser", x: 30 * T, y: 13 * T, w: T, h: T,
      rules: [
        { when: { type: "always" }, do: { type: "walk", speed: "slow" } },
        { when: { type: "playerWithin", dist: "normal" }, do: { type: "chase", speed: "normal" }, priority: 1 },
      ],
      vuln: { stomp: "die" }, hp: 2, contactDamage: true,
    },
  ] as MonsterSpec[],

  // 잡고 던질 수 있는 일반 파츠 (K로 잡기 §30)
  carryables: [
    { id: "rock1", x: 11 * T, y: 13 * T },
    { id: "rock2", x: 26.5 * T, y: 13 * T },
  ],

  items: [
    { id: "it1", kind: "speed", x: 10 * T, y: 12.5 * T },
    { id: "it2", kind: "sizeUp", x: 19 * T, y: 10 * T },
    { id: "it3", kind: "invincible", x: 35 * T, y: 12.5 * T },
  ] as ItemSpec[],
};
