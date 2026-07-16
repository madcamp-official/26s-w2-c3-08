// baseworld 테스트 맵: 지형 + 시험 파츠 배치 (라인 1개짜리).
// 점프 높이 ~1칸(jump.velocity 기준) 기준으로 모든 발판을 도달 가능하게 재배치.
// 더 높은 곳은 벽점프 샤프트 / 스프링 / 이동발판으로만 오르게 설계.
import type { Terrain } from "../physics/terrain.js";
import { SOLID_ALL, SOLID_TOP } from "../physics/terrain.js";
import type { BlockSpec } from "../parts/block.js";
import type { MonsterSpec } from "../parts/monster.js";
import type { ItemSpec } from "../parts/item.js";
import type { LineBounds } from "../parts/world.js";
import { TUNING } from "../physics/tuning.js";

const T = TUNING.world.tileSize;   // 타일 크기 단일 원천 — tileSize 바꾸면 맵도 비례

export const TESTMAP = {
  width: 92 * T,
  height: 15 * T,
  spawn: { x: 2 * T, y: 12 * T },
  line: { startX: 0, endX: 92 * T, index: 0 } satisfies LineBounds,

  terrain: {
    // 바닥 윗면 = 13T. 발판 윗면은 이전 지면에서 1칸(~1.4칸 최대) 이내로만 배치.
    // G(40~50T) = 신규 기능 전시 구간(§A·§B, 2026-07-15) — 넉백/얼음/대시/컨베이어/도넛/라이드/점멸.
    // H(52~90T) = 확장 전시 구간(2026-07-16) — 진자/회전화염/대포/이동발판/몬스터 다종/아이템 다종.
    solids: [
      { x: 0, y: 13 * T, w: 92 * T, h: 2 * T, faces: SOLID_ALL },       // 바닥
      { x: -T, y: 0, w: T, h: 15 * T, faces: SOLID_ALL },                // 좌벽
      { x: 92 * T, y: 0, w: T, h: 15 * T, faces: SOLID_ALL },            // 우벽
      // ── H 전시 구간 발판 ──
      { x: 62 * T, y: 10 * T, w: 2 * T, h: T, faces: SOLID_ALL },        // 대포 발판 앞 계단
      { x: 78 * T, y: 11 * T, w: 2 * T, h: T, faces: SOLID_ALL },        // 스프링 도달 발판
      { x: 82 * T, y: 8 * T, w: 3 * T, h: T, faces: SOLID_ALL },         // 상단 보상 발판(7~8T)
      { x: 88 * T, y: 12 * T, w: 2 * T, h: T, faces: SOLID_ALL },        // 마지막 계단
      // A 시작: 1칸 계단 → 반통과 발판 (각 1칸씩)
      { x: 5 * T, y: 12 * T, w: 2 * T, h: T, faces: SOLID_ALL },         // 계단 (12T)
      { x: 8 * T, y: 11 * T, w: 3 * T, h: 0.6 * T, faces: SOLID_TOP },   // 반통과 발판 (11T)
      // B 벽점프 샤프트: 두 기둥 사이(1.5칸 폭)를 지그재그로 올라 상단 7T 도달
      // 바닥 한 칸(12~13T) 뚫음 — 지면으로 통과 가능(웅크려서). 2026-07-16.
      { x: 13 * T, y: 7 * T, w: T, h: 5 * T, faces: SOLID_ALL },         // 좌기둥(바닥 한칸 개방)
      { x: 15.5 * T, y: 7 * T, w: T, h: 5 * T, faces: SOLID_ALL },       // 우기둥(바닥 한칸 개방)
      { x: 15.5 * T, y: 7 * T, w: 4 * T, h: T, faces: SOLID_ALL },       // 상단 ledge (7T)
      // C 상단 길: 7T 발판들 (갭 점프)
      { x: 22 * T, y: 7 * T, w: 2 * T, h: T, faces: SOLID_ALL },         // 상단 발판 (7T)
      // D 낮은 터널 천장 (지면으로 지나감)
      { x: 25 * T, y: 9 * T, w: 3 * T, h: T, faces: SOLID_ALL },
      // F 골 앞 계단 (1칸)
      { x: 36 * T, y: 12 * T, w: 2 * T, h: T, faces: SOLID_ALL },
    ],
    slopes: [
      { x: 30 * T, y: 11 * T, w: 3 * T, h: 2 * T, dir: 1, kind: "floor" },   // 오르막
      { x: 34 * T, y: 11 * T, w: 3 * T, h: 2 * T, dir: -1, kind: "floor" },  // 내리막
    ],
  } as Terrain,

  blocks: [
    // 물음표 블록 — 바닥/계단에서 점프해 아래서 치면 아이템 (바닥 11T 근처)
    {
      id: "q1", x: 10 * T, y: 10 * T, w: T, h: T,
      breakBy: {}, emitsItem: { assets: ["speed"], random: false },
    },
    // 파괴 블록 — 샤프트 상단 ledge(7T)에서 머리치기/내려찍기
    {
      id: "brk1", x: 18 * T, y: 6 * T, w: T, h: T,
      breakBy: { headbutt: true, pound: true, shell: true, explosion: true },
    },
    // 왕복 리프트 — 후반 대체 루트 (behavior 통합)
    {
      id: "lift1", x: 32 * T, y: 9 * T, w: 3 * T, h: 0.6 * T,
      faces: { top: true, bottom: false, left: false, right: false },
      rules: [{ when: { type: "always" }, do: { type: "patrol", speed: "slow" } }],
    },
    // 트램펄린 — 바닥에서 밟아 상단 발판까지 발사
    { id: "spring1", x: 20 * T, y: 12 * T, w: T, h: T, properties: [{ type: "trampoline" }] },
    // 스위치 토글 — 시작부 바닥
    // 바닥에서 1칸 띄움 — 다시 원복(2026-07-16). 1칸(64px)은 서 있는 키(96px)로는 못 들어가고
    // 웅크린 키(60.8px)로만 겨우 들어가는 의도된 좁은 틈. 판정 쪽(BaseworldScene bonkHead의
    // ceilBonk 인정)으로 고쳐서 이 좁은 틈에서도 웅크려 점프하면 정상적으로 머리치기가 잡힘.
    { id: "sw1", x: 3 * T, y: 11 * T, w: T, h: T, properties: [{ type: "switchToggle" }] },
    // 스위치 연동 (ON일 때 표시) — 상단 보상 발판
    { id: "swblk1", x: 24 * T, y: 6 * T, w: 2 * T, h: T, switchReact: { mode: "show", whenOn: true } },

    // ── G 전시 구간(40~50T) — 신규 구현 기능 데모(§A·§B, 2026-07-15) ──
    // 넉백(범퍼) — buildBlock의 contactEffect:knockback과 동일 물성
    { id: "bump1", x: 41 * T, y: 12 * T, w: T, h: T, properties: [{ type: "knockback", power: 900 }] },
    // 얼음(미끄러움) — §2 서리 광택 오버레이 데모
    { id: "ice1", x: 42 * T, y: 12 * T, w: T, h: T, properties: [{ type: "ice" }] },
    // 대시(가속판) — §2 스피드 라인 오버레이 데모
    { id: "dash1", x: 43 * T, y: 12 * T, w: T, h: T, properties: [{ type: "dash" }] },
    // 컨베이어 — §2 방향 화살표 오버레이 데모
    {
      id: "conv1", x: 44 * T, y: 12.4 * T, w: 2 * T, h: 0.6 * T,
      faces: { top: true, bottom: false, left: false, right: false },
      properties: [{ type: "conveyor", dir: "right", speed: 150 }],
    },
    // 도넛(낙하 반응) — 밟으면 0.5초 후 붕괴(§A-2 crumbleFall)
    { id: "donut1", x: 47 * T, y: 12 * T, w: T, h: T, rules: [{ when: { type: "ridden" }, do: { type: "crumbleFall" } }] },
    // 라이드 리프트 — 밟으면 위로 주행(§A-3 shuttle, ride_start)
    {
      id: "ride1", x: 48 * T, y: 12 * T, w: 1.5 * T, h: 0.5 * T,
      faces: { top: true, bottom: false, left: false, right: false },
      rules: [{ when: { type: "ridden" }, do: { type: "shuttle", speed: "normal", endX: 48 * T, endY: 7 * T } }],
    },
    // 점멸 — §2 사라지기 직전 예고 오버레이 데모
    { id: "blink1", x: 49 * T, y: 12 * T, w: T, h: T, visibility: "blink", blinkMs: 2000 },

    // ── H 확장 전시 구간(52~90T) ──
    // 가시 — 윗면 제외 접촉 데미지(밟기는 안전)
    { id: "spike_h", x: 53 * T, y: 12 * T, w: T, h: T, properties: [{ type: "damage", part: "notTop" }] },
    // 진자 해저드 — 위 앵커에서 좌우로 스윙, 전방향 데미지
    {
      id: "pend_h", x: 56 * T, y: 5 * T, w: T, h: T, properties: [{ type: "damage", part: "all" }],
      rules: [{ when: { type: "always" }, do: { type: "pendulum", length: 192 } }],
    },
    // 회전 화염구 — 중심 기준 회전, 전방향 데미지
    {
      id: "orbit_h", x: 59 * T, y: 7 * T, w: T, h: T, properties: [{ type: "damage", part: "all" }],
      rules: [{ when: { type: "always" }, do: { type: "rotate", speed: "normal" } }],
    },
    // 대포 — 주기적으로 직선 발사체
    {
      id: "cannon_h", x: 64 * T, y: 11 * T, w: T, h: 2 * T,
      rules: [{ when: { type: "periodic", ms: 2200 }, do: { type: "shoot", speed: "normal", aim: "straight" } }],
    },
    // 이동 발판 — 좌우 왕복(위에서만 탑승)
    {
      id: "mov_h", x: 68 * T, y: 10 * T, w: 3 * T, h: 0.6 * T,
      faces: { top: true, bottom: false, left: false, right: false },
      rules: [{ when: { type: "always" }, do: { type: "patrol", speed: "normal" } }],
    },
    // 얼음 바닥 구간(미끄러움) — 3칸
    { id: "ice_h1", x: 73 * T, y: 12 * T, w: T, h: T, properties: [{ type: "ice" }] },
    { id: "ice_h2", x: 74 * T, y: 12 * T, w: T, h: T, properties: [{ type: "ice" }] },
    { id: "ice_h3", x: 75 * T, y: 12 * T, w: T, h: T, properties: [{ type: "ice" }] },
    // 스프링 — 상단 보상 발판(82T,8T)까지 발사
    { id: "spring_h", x: 80 * T, y: 12 * T, w: T, h: T, properties: [{ type: "trampoline" }] },
    // 파괴 블록 — 상단 보상 위
    { id: "brk_h", x: 83 * T, y: 7 * T, w: T, h: T, breakBy: { headbutt: true, pound: true } },
    // 물음표(거대버섯) — 마지막 계단 위
    { id: "q_h", x: 88 * T, y: 10 * T, w: T, h: T, breakBy: {}, emitsItem: { assets: ["giant"], random: false } },
  ] as BlockSpec[],

  monsters: [
    // 굼바형: 왕복 + 밟기 즉사 (바닥)
    {
      id: "gm1", asset: "goomba", x: 8 * T, y: 13 * T, w: T, h: T,
      rules: [{ when: { type: "always" }, do: { type: "patrol", speed: "slow", turnAtLedge: false } }],
      vuln: { stomp: "die" }, hp: 1, contactDamage: true,
    },
    // 쿵쿵형: 대기 → 아래 접근 시 낙하(선딜) → 복귀 (상단 길 위)
    {
      id: "th1", asset: "thwomp", x: 22.5 * T, y: 8 * T, w: 1.5 * T, h: 1.5 * T,
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
    // 추적형 (HP 2) — 경사 앞 바닥, 돌 던지기/슬라이드로 처치
    {
      id: "ch1", asset: "chaser", x: 31 * T, y: 13 * T, w: T, h: T,
      rules: [
        { when: { type: "always" }, do: { type: "walk", speed: "slow" } },
        { when: { type: "playerWithin", dist: "normal" }, do: { type: "chase", speed: "normal" }, priority: 1 },
      ],
      vuln: { stomp: "die" }, hp: 2, contactDamage: true,
    },
    // ── G 전시 구간 몬스터(§A-1·A-4 데모) ──
    // 넉백형 — 접촉해도 피해 없이 밀려남
    {
      id: "sh1", asset: "shove", x: 45 * T, y: 13 * T, w: T, h: T,
      rules: [{ when: { type: "always" }, do: { type: "idle" } }],
      vuln: { stomp: "die" }, hp: 1, contactDamage: true, shove: true,
    },
    // 분열형 — 처치 시 축소된 자식 2마리로 갈라짐
    {
      id: "sp1", asset: "splitter", x: 46 * T, y: 13 * T, w: T, h: T,
      rules: [{ when: { type: "always" }, do: { type: "idle" } }],
      vuln: { stomp: "die" }, hp: 1, contactDamage: true, splitOnDeath: true,
    },

    // ── H 확장 전시 구간 몬스터 ──
    // 코파형 — 밟으면 등껍질화(껍질 발차기)
    {
      id: "koopa_h", asset: "koopa", x: 66 * T, y: 13 * T, w: T, h: 2 * T,
      rules: [{ when: { type: "always" }, do: { type: "patrol", speed: "slow", turnAtLedge: true } }],
      vuln: { stomp: "shellify" }, shell: true, hp: 1, contactDamage: true,
    },
    // 부 형(비행) — 밟으면 기절
    {
      id: "boo_h", asset: "boo", x: 71 * T, y: 9 * T, w: T, h: T,
      rules: [{ when: { type: "always" }, do: { type: "fly" } }],
      vuln: { stomp: "stun" }, hp: 1, contactDamage: true,
    },
    // 가시돌이형 — 밟으면 밟은 쪽이 피해(가시 반응)
    {
      id: "spiny_h", asset: "spiny", x: 76 * T, y: 13 * T, w: T, h: T,
      rules: [{ when: { type: "always" }, do: { type: "patrol", speed: "normal", turnAtLedge: true } }],
      vuln: { stomp: "hurtAttacker" }, hp: 1, contactDamage: true,
    },
    // 발사형(HP2) — 주기적으로 직선 발사, 걸어다님
    {
      id: "shooter_h", asset: "shooter", x: 85 * T, y: 13 * T, w: T, h: 2 * T,
      rules: [
        { when: { type: "always" }, do: { type: "walk", speed: "slow" } },
        { when: { type: "periodic", ms: 2000 }, do: { type: "shoot", speed: "normal", aim: "straight" }, priority: 1 },
      ],
      vuln: { stomp: "die" }, hp: 2, contactDamage: true,
    },
  ] as MonsterSpec[],

  // 잡고 던질 수 있는 일반 파츠 (K로 잡기 §30)
  carryables: [
    { id: "rock1", x: 6 * T, y: 13 * T },
    { id: "rock2", x: 28 * T, y: 13 * T },
  ],

  items: [
    { id: "it1", kind: "speed", x: 11 * T, y: 11 * T },       // q1/반통과 발판 근처
    { id: "it2", kind: "sizeUp", x: 19 * T, y: 6 * T },        // 샤프트 상단 보상
    { id: "it3", kind: "invincible", x: 37 * T, y: 12 * T },   // 골 앞
    // ── H 확장 전시 구간 아이템 ──
    { id: "it_hp", kind: "hpUp", x: 60 * T, y: 12 * T },        // 대포 앞
    { id: "it_score", kind: "score", x: 72 * T, y: 12 * T, score: 100 },  // 이동발판 뒤
    { id: "it_big", kind: "giant", x: 83 * T, y: 6 * T },       // 상단 보상 발판
    { id: "it_down", kind: "sizeDown", x: 89 * T, y: 12 * T },  // 마지막
  ] as ItemSpec[],
};
