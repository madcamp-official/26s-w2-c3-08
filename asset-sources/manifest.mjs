// 스타터 에셋 매니페스트 — 전수 커버(BlockAttrs/MonsterAttrs 거의 모든 enum·불리언 값 최소 1회) 목록.
// attrs는 shared/schemas/{block,monster,background,item,avatar}.ts의 zod 스키마와 필드명 1:1 —
// parseAttrs(category, attrs)로 그대로 검증 통과해야 함. 그림은 아직 없음(파일만 지정, 대기 중).
//
// 사용법:
//   import { ASSETS, SYSTEM_ICONS } from "./manifest.mjs";
//   각 항목의 attrs를 SubmitAssetInput.attrs로, file을 읽어 sourceImageUrl 업로드용으로 그대로 사용.
//
// tiles: attrs.size가 있는 카테고리(block/monster/background)는 attrs.size와 항상 동일해야 함
//   (중복 기입이지만 그림 그릴 때 캔버스 크기를 attrs까지 안 파고들어도 바로 보이게 하려는 편의 필드).
//   avatar/item은 attrs에 size가 없어 tiles만이 유일한 캔버스 크기 정보(고정 관례).
//
// isSystem: 전부 true — 특정 창작자가 아니라 게임이 기본 제공하는 스타터 라이브러리이므로.

/** @typedef {{w:number,h:number}} Tiles */

// ============================================================================
// 몬스터 (24) — locomotion 4종·pursuit 6종·stompReaction 6종·shooter.arc 3종·
// hp 1~3·contactDamage false·enrage·shove·hop·emerge·teleport·anchor·immortal·splitOnDeath 전수 커버
// ============================================================================
export const MONSTERS = [
  {
    id: "goomba", name: "goomba", category: "monster", file: "monster/goomba.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      locomotion: { type: "walk", speed: "normal", cliff: "fall" },
      pursuit: { type: "none" },
      stompReaction: { type: "die" },
      hp: 1, contactDamage: true,
      shooter: null, hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "koopa", name: "koopa", category: "monster", file: "monster/koopa.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 2 },
    attrs: {
      v: 1, size: { w: 1, h: 2 },
      locomotion: { type: "walk", speed: "normal", cliff: "turn" },
      pursuit: { type: "none" },
      stompReaction: { type: "shell" }, // 밟으면 등껍질로 변해 차서 굴리기
      hp: 1, contactDamage: true,
      shooter: null, hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "buzzy-beetle", name: "buzzy beetle", category: "monster", file: "monster/buzzy-beetle.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      locomotion: { type: "walk", speed: "slow", cliff: "turn" },
      pursuit: { type: "none" },
      stompReaction: { type: "spiky" }, // 딱지 있어서 밟으면 밟는 쪽이 다침
      hp: 1, contactDamage: true,
      shooter: null, hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "spiny", name: "spiny", category: "monster", file: "monster/spiny.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      locomotion: { type: "walk", speed: "normal", cliff: "fall" },
      pursuit: { type: "none" },
      stompReaction: { type: "spiky" },
      hp: 1, contactDamage: true,
      shooter: null, hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "piranha", name: "piranha plant", category: "monster", file: "monster/piranha.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 2 },
    attrs: {
      v: 1, size: { w: 1, h: 2 },
      locomotion: { type: "stationary" },
      pursuit: { type: "none" },
      stompReaction: { type: "die" },
      hp: 1, contactDamage: true,
      shooter: null, hop: null,
      emerge: { trigger: "periodic", period: "normal", range: "normal" }, // 숨어있다 주기적으로 등장
      teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "boo", name: "boo", category: "monster", file: "monster/boo.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      locomotion: { type: "fly" },
      pursuit: { type: "sight" }, // 보면 얼어붙고 안 보면 쫓아옴(부끄부끄) — 판정은 behavior 쪽 몫
      stompReaction: { type: "stun", respawn: "normal" },
      hp: 1, contactDamage: true,
      shooter: null, hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "bob-omb", name: "bob-omb", category: "monster", file: "monster/bob-omb.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      locomotion: { type: "walk", speed: "slow", cliff: "fall" },
      pursuit: { type: "none" },
      stompReaction: { type: "explode", radius: "normal" },
      hp: 1, contactDamage: true,
      shooter: null, hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "chain-chomp", name: "chain chomp", category: "monster", file: "monster/chain-chomp.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 2, h: 2 },
    attrs: {
      v: 1, size: { w: 2, h: 2 },
      locomotion: { type: "stationary" },
      pursuit: { type: "always" },
      stompReaction: { type: "spiky" }, // immortal 제약: hp=1 & spiky 필수
      hp: 1, contactDamage: true,
      shooter: null, hop: null, emerge: null, teleport: null,
      anchor: true, // 돌진 후 원위치 복귀(사슬)
      enrage: false, splitOnDeath: false,
      immortal: true, // superRefine: hp===1 && stompReaction==="spiky" 필수 — 위에서 충족
      shove: false,
    },
  },
  {
    id: "lakitu", name: "lakitu", category: "monster", file: "monster/lakitu.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 2, h: 2 },
    attrs: {
      v: 1, size: { w: 2, h: 2 },
      locomotion: { type: "fly" },
      pursuit: { type: "proximity", range: "far" }, // 하늘에서 멀리서도 감지
      stompReaction: { type: "die" },
      hp: 1, contactDamage: true,
      shooter: { trigger: "proximity", period: "normal", arc: "arc", range: "far" },
      hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "hammer-bro", name: "hammer bro", category: "monster", file: "monster/hammer-bro.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 2 },
    attrs: {
      v: 1, size: { w: 1, h: 2 },
      locomotion: { type: "walk", speed: "normal", cliff: "turn" },
      pursuit: { type: "none" },
      stompReaction: { type: "stun", respawn: "normal" },
      hp: 2, contactDamage: true,
      shooter: { trigger: "periodic", period: "normal", arc: "arc", range: "normal" },
      hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "straight-shooter", name: "straight shooter", category: "monster", file: "monster/straight-shooter.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      locomotion: { type: "walk", speed: "slow", cliff: "turn" },
      pursuit: { type: "none" },
      stompReaction: { type: "die" },
      hp: 1, contactDamage: true,
      shooter: { trigger: "periodic", period: "normal", arc: "straight", range: "normal" },
      hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "tracker-homing", name: "homing tracker", category: "monster", file: "monster/tracker-homing.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      locomotion: { type: "fly" },
      pursuit: { type: "proximity", range: "normal" },
      stompReaction: { type: "die" },
      hp: 2, contactDamage: true,
      shooter: { trigger: "proximity", period: "normal", arc: "homing", range: "normal" },
      hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "king-splitter", name: "king splitter", category: "monster", file: "monster/king-splitter.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      locomotion: { type: "walk", speed: "slow", cliff: "fall" },
      pursuit: { type: "proximity", range: "normal" },
      stompReaction: { type: "die" },
      hp: 2, contactDamage: true,
      shooter: null,
      hop: { height: "high" }, // 주기 도약
      emerge: null, teleport: null,
      anchor: false, enrage: false,
      splitOnDeath: true, // 사망 시 분열 2마리
      immortal: false, shove: false,
    },
  },
  {
    id: "teleport-boss", name: "teleport boss", category: "monster", file: "monster/teleport-boss.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 2 },
    attrs: {
      v: 1, size: { w: 1, h: 2 },
      locomotion: { type: "walk", speed: "slow", cliff: "turn" },
      pursuit: { type: "always" },
      stompReaction: { type: "die" },
      hp: 3, contactDamage: true,
      shooter: null, hop: null, emerge: null,
      teleport: { trigger: "periodic", period: "normal" },
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "creeper", name: "creeper-ish", category: "monster", file: "monster/creeper.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 2 },
    attrs: {
      v: 1, size: { w: 1, h: 2 },
      locomotion: { type: "walk", speed: "normal", cliff: "fall" },
      pursuit: { type: "proximity", range: "normal" },
      stompReaction: { type: "explode", radius: "normal" },
      hp: 1, contactDamage: true,
      shooter: null, hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "zombie", name: "zombie-ish", category: "monster", file: "monster/zombie.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 2 },
    attrs: {
      v: 1, size: { w: 1, h: 2 },
      locomotion: { type: "walk", speed: "slow", cliff: "fall" },
      pursuit: { type: "proximity", range: "normal" },
      stompReaction: { type: "die" },
      hp: 2, contactDamage: true,
      shooter: null, hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "spider", name: "spider-ish", category: "monster", file: "monster/spider.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 2, h: 1 },
    attrs: {
      v: 1, size: { w: 2, h: 1 },
      locomotion: { type: "climb" },
      pursuit: { type: "sight" },
      stompReaction: { type: "die" },
      hp: 1, contactDamage: true,
      shooter: null, hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "enderman", name: "enderman-ish", category: "monster", file: "monster/enderman.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 3 },
    attrs: {
      v: 1, size: { w: 1, h: 3 },
      locomotion: { type: "walk", speed: "slow", cliff: "fall" },
      pursuit: { type: "always" },
      stompReaction: { type: "die" },
      hp: 3, contactDamage: true,
      shooter: null, hop: null, emerge: null,
      teleport: { trigger: "on_hit", period: "normal" },
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "trampoline-ball", name: "trampoline ball", category: "monster", file: "monster/trampoline-ball.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      locomotion: { type: "walk", speed: "normal", cliff: "fall" },
      pursuit: { type: "none" },
      stompReaction: { type: "trampoline" }, // 밟으면 튕겨오름(밟는 쪽 이득)
      hp: 1, contactDamage: true,
      shooter: null, hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "shy-fleer", name: "shy fleer", category: "monster", file: "monster/shy-fleer.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      locomotion: { type: "walk", speed: "normal", cliff: "fall" },
      pursuit: { type: "flee", range: "normal" }, // 보면 도망
      stompReaction: { type: "die" },
      hp: 1, contactDamage: true,
      shooter: null, hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "hop-syncer", name: "hop syncer", category: "monster", file: "monster/hop-syncer.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      locomotion: { type: "walk", speed: "normal", cliff: "fall" },
      pursuit: { type: "jump_sync" }, // 플레이어 점프 타이밍에 맞춰 뜀
      stompReaction: { type: "die" },
      hp: 1, contactDamage: true,
      shooter: null,
      hop: { height: "low" },
      emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "enrager", name: "enrager", category: "monster", file: "monster/enrager.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      locomotion: { type: "walk", speed: "slow", cliff: "fall" },
      pursuit: { type: "proximity", range: "normal" },
      stompReaction: { type: "die" },
      hp: 2, contactDamage: true,
      shooter: null, hop: null, emerge: null, teleport: null,
      anchor: false,
      enrage: true, // 밟으면 분노 — 가속+추적
      splitOnDeath: false, immortal: false, shove: false,
    },
  },
  {
    id: "pushable-crate-mob", name: "pushable (harmless)", category: "monster", file: "monster/pushable-crate-mob.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      locomotion: { type: "walk", speed: "slow", cliff: "fall" },
      pursuit: { type: "none" },
      stompReaction: { type: "die" },
      hp: 1,
      contactDamage: false, // 무해 — 피해 대신 밀림
      shooter: null, hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false,
      shove: true, // 접촉 시 넉백만
    },
  },
  {
    id: "boss-big", name: "boss (big)", category: "monster", file: "monster/boss-big.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 3, h: 2 },
    attrs: {
      v: 1, size: { w: 3, h: 2 },
      locomotion: { type: "walk", speed: "slow", cliff: "turn" },
      pursuit: { type: "always" },
      stompReaction: { type: "die" },
      hp: 3, contactDamage: true,
      shooter: null, hop: null, emerge: null, teleport: null,
      anchor: false, enrage: false, splitOnDeath: false, immortal: false, shove: false,
    },
  },
];

// ============================================================================
// 블록 (29) — collision 4종·shape 2종·presence 5종·motion 7종·contactEffect 4종(damage zone 3종)·
// contactReaction 2종·trigger 4종·slippery/dash/conveyor/bouncy/shooter/harmMonsters/breakBlocks/
// togglesSwitch 전수 커버. superRefine 제약(contactReaction≠none ⇒ motion=none, shape=slope ⇒
// motion=none && contactReaction=none) 전부 준수.
// ============================================================================
export const BLOCKS = [
  {
    id: "brick", name: "brick block", category: "block", file: "block/brick.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "full" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "question-block", name: "question block", category: "block", file: "block/question-block.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "full" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "ice-block", name: "ice block", category: "block", file: "block/ice-block.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "full" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: true, // ← 커버 대상
      conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "breakable-block", name: "breakable block", category: "block", file: "block/breakable-block.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "full" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "none" }, contactEffect: { type: "none" },
      contactReaction: { type: "break", senseFaces: { top: true, bottom: false, left: false, right: false } },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "falling-platform", name: "falling platform", category: "block", file: "block/falling-platform.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 2, h: 1 },
    attrs: {
      v: 1, size: { w: 2, h: 1 },
      collision: { type: "top_only" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "none" }, contactEffect: { type: "none" },
      contactReaction: { type: "fall", senseFaces: { top: true, bottom: false, left: false, right: false } },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "moving-platform", name: "moving platform", category: "block", file: "block/moving-platform.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 3, h: 1 },
    attrs: {
      v: 1, size: { w: 3, h: 1 },
      collision: { type: "top_only" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "patrol", speed: "normal" },
      contactEffect: { type: "none" }, contactReaction: { type: "none" }, // motion≠none이라 반드시 none
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "pendulum-hazard", name: "pendulum hazard", category: "block", file: "block/pendulum-hazard.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "none" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "pendulum" },
      contactEffect: { type: "damage", zone: "all" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "spin-fireball", name: "orbiting fireball", category: "block", file: "block/spin-fireball.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      // 톱니바퀴 대체 — 궤도회전(공전). 제자리 자전 옵션은 스키마에 없음(알려진 갭, handoff 문서 참조).
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "none" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "spin", speed: "normal", radius: "normal" },
      contactEffect: { type: "damage", zone: "all" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "charge-block", name: "charge block (thwomp-ish)", category: "block", file: "block/charge-block.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "full" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "charge", dir: "down", after: "return" },
      contactEffect: { type: "damage", zone: "all" }, contactReaction: { type: "none" },
      trigger: { type: "proximity", axis: "y", range: "normal" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "spring", name: "spring", category: "block", file: "block/spring.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "full" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "none" },
      contactEffect: { type: "knockback", power: "high" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null,
      bouncy: { power: "high" }, // ← 커버 대상
      dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "updraft-fan", name: "updraft fan", category: "block", file: "block/updraft-fan.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "none" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "none" },
      contactEffect: { type: "updraft" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "conveyor-belt", name: "conveyor belt", category: "block", file: "block/conveyor-belt.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 3, h: 1 },
    attrs: {
      v: 1, size: { w: 3, h: 1 },
      collision: { type: "full" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false,
      conveyor: { dir: "right", speed: "normal" }, // 좌우는 렌더 시 반전 처리, 그림은 1개로 충분
      bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "dash-panel", name: "dash panel", category: "block", file: "block/dash-panel.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "full" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null,
      dash: true, // ← 커버 대상
      shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "cannon-straight", name: "cannon (straight)", category: "block", file: "block/cannon-straight.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 2 },
    attrs: {
      v: 1, size: { w: 1, h: 2 },
      collision: { type: "full" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "periodic", period: "normal" },
      slippery: false, conveyor: null, bouncy: null, dash: false,
      shooter: { period: "normal", speed: "normal", aim: "straight", stopNearPlayer: false },
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "cannon-homing", name: "cannon (homing)", category: "block", file: "block/cannon-homing.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 2 },
    attrs: {
      v: 1, size: { w: 1, h: 2 },
      collision: { type: "full" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "proximity", axis: "radius", range: "normal" },
      slippery: false, conveyor: null, bouncy: null, dash: false,
      shooter: { period: "normal", speed: "normal", aim: "homing", stopNearPlayer: true },
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "switch-block-on", name: "switch block (on)", category: "block", file: "block/switch-block-on.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "full" }, shape: { type: "rect" },
      presence: { type: "switch_on" },
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false,
      togglesSwitch: true, // ← 커버 대상
    },
  },
  {
    id: "switch-block-off", name: "switch block (off)", category: "block", file: "block/switch-block-off.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "full" }, shape: { type: "rect" },
      presence: { type: "switch_off" }, // ← 커버 대상
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "blink-block", name: "blinking block", category: "block", file: "block/blink-block.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "full" }, shape: { type: "rect" },
      presence: { type: "blink", period: "normal" },
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "hidden-block", name: "hidden block", category: "block", file: "block/hidden-block.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "full" }, shape: { type: "rect" },
      presence: { type: "hidden" }, // ← 커버 대상
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "spike-row", name: "spike row (top-safe)", category: "block", file: "block/spike-row.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 3, h: 1 },
    attrs: {
      v: 1, size: { w: 3, h: 1 },
      collision: { type: "none" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "none" },
      contactEffect: { type: "damage", zone: "except_top" }, // ← zone 커버 대상
      contactReaction: { type: "none" },
      trigger: { type: "switch" }, // ← trigger 커버 대상
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: true, // ← 커버 대상
      breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "icicle", name: "icicle (bottom-only)", category: "block", file: "block/icicle.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "none" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "none" },
      contactEffect: { type: "damage", zone: "bottom_only" }, // ← zone 커버 대상
      contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "corner-wall", name: "corner wall (faces)", category: "block", file: "block/corner-wall.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "faces", faces: { top: true, bottom: false, left: true, right: false } }, // ← 커버 대상
      shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "ride-start", name: "ride start platform", category: "block", file: "block/ride-start.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "top_only" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "ride_start" }, // ← 커버 대상
      contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "ride-oneway", name: "ride one-way platform", category: "block", file: "block/ride-oneway.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 2, h: 1 },
    attrs: {
      v: 1, size: { w: 2, h: 1 },
      collision: { type: "top_only" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "ride_oneway", sink: false }, // ← 커버 대상
      contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "breakblocks-block", name: "wrecking block", category: "block", file: "block/breakblocks-block.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 },
    attrs: {
      v: 1, size: { w: 1, h: 1 },
      collision: { type: "full" }, shape: { type: "rect" }, presence: { type: "always" },
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false,
      breakBlocks: true, // ← 커버 대상 (자신이 아니라 남을 깨는 옵션)
      togglesSwitch: false,
    },
  },
  {
    id: "slope-floor-asc", name: "slope (floor-asc)", category: "block", file: "block/slope-floor-asc.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 2, h: 2 }, // 이미 그림 있음(구 파일명 slope-floorasc-2x2.png)
    attrs: {
      v: 1, size: { w: 2, h: 2 },
      collision: { type: "faces", faces: { top: true, bottom: true, left: true, right: true } },
      shape: { type: "slope", dir: "floor-asc" },
      presence: { type: "always" },
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" }, // shape=slope 제약
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "slope-floor-desc", name: "slope (floor-desc)", category: "block", file: "block/slope-floor-desc.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 2, h: 2 },
    attrs: {
      v: 1, size: { w: 2, h: 2 },
      collision: { type: "faces", faces: { top: true, bottom: true, left: true, right: true } },
      shape: { type: "slope", dir: "floor-desc" },
      presence: { type: "always" },
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "slope-ceil-desc", name: "slope (ceil-desc)", category: "block", file: "block/slope-ceil-desc.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 2, h: 2 }, // 이미 그림 있음(구 파일명 slope-ceildesc-2x2.png)
    attrs: {
      v: 1, size: { w: 2, h: 2 },
      collision: { type: "faces", faces: { top: true, bottom: true, left: true, right: true } },
      shape: { type: "slope", dir: "ceil-desc" },
      presence: { type: "always" },
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
  {
    id: "slope-ceil-asc", name: "slope (ceil-asc)", category: "block", file: "block/slope-ceil-asc.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 2, h: 2 },
    attrs: {
      v: 1, size: { w: 2, h: 2 },
      collision: { type: "faces", faces: { top: true, bottom: true, left: true, right: true } },
      shape: { type: "slope", dir: "ceil-asc" },
      presence: { type: "always" },
      motion: { type: "none" }, contactEffect: { type: "none" }, contactReaction: { type: "none" },
      trigger: { type: "always" },
      slippery: false, conveyor: null, bouncy: null, dash: false, shooter: null,
      harmMonsters: false, breakBlocks: false, togglesSwitch: false,
    },
  },
];

// ============================================================================
// 배경 (5) — BackgroundAttrs={v,size}뿐. 라인당 1개만 쓰는 순수 배경(장식 다수 아님).
// 서로 다른 라인용 테마 후보. 최대 크기(4x4) 그대로 사용.
// ============================================================================
export const BACKGROUNDS = [
  { id: "bg-grassland", name: "grassland backdrop", category: "background", file: "background/bg-grassland.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 4, h: 4 }, attrs: { v: 1, size: { w: 4, h: 4 } } },
  { id: "bg-cave", name: "cave backdrop", category: "background", file: "background/bg-cave.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 4, h: 4 }, attrs: { v: 1, size: { w: 4, h: 4 } } },
  { id: "bg-castle", name: "castle backdrop", category: "background", file: "background/bg-castle.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 4, h: 4 }, attrs: { v: 1, size: { w: 4, h: 4 } } },
  { id: "bg-night-sky", name: "night sky backdrop", category: "background", file: "background/bg-night-sky.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 4, h: 4 }, attrs: { v: 1, size: { w: 4, h: 4 } } },
  { id: "bg-underwater", name: "underwater backdrop", category: "background", file: "background/bg-underwater.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 4, h: 4 }, attrs: { v: 1, size: { w: 4, h: 4 } } },
];

// ============================================================================
// 아이템 (2) — ItemAttrs={v,effect}뿐. 시스템 제공 2종 고정(유저 제작 불가, §item.ts 주석).
// size 필드 없음 — tiles는 그림 캔버스 관례일 뿐 attrs엔 안 들어감.
// ============================================================================
export const ITEMS = [
  { id: "item-giant-mushroom", name: "giant mushroom", category: "item", file: "item/item-giant-mushroom.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 }, attrs: { v: 1, effect: "giant_mushroom" } },
  { id: "item-speed-boost", name: "speed boost", category: "item", file: "item/item-speed-boost.png",
    isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 1 }, attrs: { v: 1, effect: "speed_boost" } },
];

// ============================================================================
// 아바타 (16) — AvatarAttrs={v:1}뿐(유저 선택 속성 없음). 크기는 항상 1x2 고정(player-spec.md),
// attrs엔 size가 없어 tiles만이 캔버스 크기 정보. 키는 1.5타일로 캔버스(2타일) 안에 여백 두고 그림
// (gen-asset-prototype.mjs의 humanoidGeom 관례). 원작 그대로가 아니라 손그림 스타일 재해석.
// ============================================================================
export const AVATARS = [
  "mario", "luigi", "princess", "toad", "gorilla", "mouse", "goose", "croc",
  "steve", "creeper", "speedster", "kirby", "robot", "turtleninja", "knight", "pirate",
].map((id) => ({
  id: `avatar-${id}`, name: id, category: "avatar", file: `avatar/${id}.png`,
  isSystem: true, sourceType: "drawn", tiles: { w: 1, h: 2 },
  attrs: { v: 1 },
}));

// ============================================================================
// 시스템 UI 아이콘 — Asset 카테고리가 아님(/api/asset/submit 대상 아님). carry 상태 오버레이용.
// 깃발/바닥은 shared/race/flagpole.ts(FLAGPOLE 상수)·docs/KJH/screen-design.md §126-137 참조:
// "깃발은 에셋이 아니라 라인 메타데이터"(startFlag/endFlag는 MapLine 필드) — 여기 목록은 그 렌더용
// 정적 이미지일 뿐 DB Asset 테이블과 무관.
// ============================================================================
export const SYSTEM_ICONS = [
  {
    id: "hand-icon", name: "carry hand icon", file: "system/hand-icon.png",
    tiles: { w: 1, h: 1 }, // 실사용은 14px(1/4타일)로 축소 — client/BaseworldScene.ts handRect 참조
    note: "흰 테두리+회색/어두운 장갑 — 유일하게 테두리 허용되는 예외 에셋. asset 테이블에 안 들어감.",
  },
  {
    id: "flag-normal", name: "checkpoint flag (normal)", file: "system/flag-normal.png",
    tiles: { w: 1, h: 5 }, // FLAGPOLE.poleHeightTiles=5 — 라인 경계(각 라인의 시작/끝) 공용 깃발
    note: "마리오 체크포인트식 초록 깃발. 병합맵의 진짜 첫 시작/최종 골이 아닌 모든 시작·끝 깃발에 씀. 테두리 없음(일반 에셋과 동일 취급).",
  },
  {
    id: "flag-long", name: "checkpoint flag (long pole)", file: "system/flag-long.png",
    tiles: { w: 1, h: 8 }, // FLAGPOLE.longPoleHeightTiles=8 — 병합맵의 진짜 시작/최종 골 전용(구분용 긴 깃대)
    note: "flag-normal과 같은 디자인, 깃대만 더 김. 맨 첫 라인의 진짜 시작 / 맨 끝 라인의 진짜 골에만 씀.",
  },
  {
    id: "floor-3x1", name: "flag base (3x1 ground)", file: "system/floor-3x1.png",
    tiles: { w: 3, h: 1 }, // FLAGPOLE.baseWidthTiles=3 — 깃발 아래 기단, 항상 깃발과 한 세트로 붙어다님
    note: "물리판정 없는 순수 마커(깃발+바닥 세트 전체가 장식). flag-normal·flag-long 둘 다에 재사용.",
  },
  {
    id: "mouse-cursor", name: "mouse cursor", file: "system/mouse-cursor.png",
    tiles: { w: 1, h: 1 }, // 32x32 고정 UI 오버레이 — 월드 스프라이트 아님, 배율은 화면 DPI에 맞춰 클라에서 조정
    note: "흰 몸통+검정 테두리 — hand-icon과 같은 이유로 테두리 허용 예외(어떤 배경 위에서도 보여야 함).",
  },
];

// ============================================================================
export const ASSETS = [...MONSTERS, ...BLOCKS, ...BACKGROUNDS, ...ITEMS, ...AVATARS];

console.log(
  `[manifest] monster=${MONSTERS.length} block=${BLOCKS.length} background=${BACKGROUNDS.length} ` +
  `item=${ITEMS.length} avatar=${AVATARS.length} → 총 ${ASSETS.length}개 (+system ${SYSTEM_ICONS.length})`,
);
