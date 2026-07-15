// attrs → 런타임 파츠 조립기 (§빌더). "유저가 고른 옵션(attrs)"을 실제 게임 오브젝트(BlockSpec/MonsterSpec)로.
// 지금까진 testmap이 손으로 스펙을 박았음 — 이 파일이 그 다리. 에디터 배치·게임 인스턴스화가 이걸 통해 만든다.
//
// 입력: 카테고리 + attrs(스키마 검증본) + geom(px 좌표/크기 + flipX + patrol 끝점).
// 출력: BlockSpec | MonsterSpec (parts). 행동은 프리셋 문자열을 그대로(액션이 내부 변환), 물성만 숫자.
//
// ⚠️ V1 — 흔한 매핑은 정확히. 아래 TODO(builder)는 아직 런타임 지원/스키마가 없어 미완:
//   - 넉백 장애물: 대응 물성 없음(instakill 제거처럼, knockback 물성 미구현)
//   - patrol/ride 끝점 경로, charge 세부, 시야/점프동기 추적, 발사 유도, 접촉반응(낙하/파괴 타이머)
//   이들은 해당 행동/물성이 생기면 채운다. 그전까진 best-effort + 주석.
import { TUNING } from "../physics/tuning.js";
import type { Faces } from "../physics/terrain.js";
import { speedPreset } from "../behavior/helpers.js";
import { collisionFaces } from "../schemas/platform.js";
import type { MonsterAttrs, ObstacleAttrs, PlatformAttrs, Power2, Period3 } from "../schemas/index.js";
import type { BlockSpec } from "../parts/block.js";
import type { MonsterSpec, StompReaction } from "../parts/monster.js";
import type { RuleSpec } from "../behavior/types.js";

/** 배치가 정한 런타임 지오메트리 (px). 에디터가 타일→px, size 반영해 계산. */
export interface BuildGeom {
  x: number; y: number; w: number; h: number;
  flipX?: boolean;
  /** patrol/ride 끝점 (px). 없으면 정적 */
  endX?: number; endY?: number;
}

type PropSpec = { type: string; [k: string]: unknown };

// ── 프리셋 → 숫자 (빌더 로컬. TODO(builder): tuning으로 이관) ──
function powerNum(p: Power2): number { return p === "high" ? 1200 : 800; }
function periodMs(p: Period3): number { return p === "short" ? 1000 : p === "long" ? 3500 : 2000; }

/** 좌우반전 시 conveyor/slope 방향 스왑용 */
function flipDir(dir: "left" | "right"): "left" | "right" { return dir === "left" ? "right" : "left"; }
function flipFaces(f: Faces): Faces { return { top: f.top, bottom: f.bottom, left: f.right, right: f.left }; }

// =============================================================================
// 플랫폼 → BlockSpec
// =============================================================================
export function buildPlatformBlock(id: string, a: PlatformAttrs, g: BuildGeom): BlockSpec {
  let faces = collisionFaces(a.collision) as Faces;
  if (g.flipX) faces = flipFaces(faces);

  const properties: PropSpec[] = [];
  if (a.slippery) properties.push({ type: "ice" });
  if (a.conveyor) {
    const dir = g.flipX ? flipDir(a.conveyor.dir) : a.conveyor.dir;
    properties.push({ type: "conveyor", dir, speed: speedPreset(a.conveyor.speed, TUNING) });
  }
  if (a.bouncy) properties.push({ type: "trampoline", power: powerNum(a.bouncy.power) });
  if (a.dash) properties.push({ type: "dash" });

  const spec: BlockSpec = { id, x: g.x, y: g.y, w: g.w, h: g.h, faces };

  // 모양(경사) — flipX면 NE↔NW 스왑. ⚠️ 방향 대응은 렌더 확인 필요.
  if (a.shape.type === "slope") spec.shape = slopeShape(a.shape.dir, g.flipX);

  // 실체화
  if (a.presence.type === "hidden") spec.visibility = "hidden";
  else if (a.presence.type === "blink") { spec.visibility = "blink"; spec.blinkMs = periodMs(a.presence.period); }
  else if (a.presence.type === "switch_on") spec.switchReact = { mode: "show", whenOn: true };
  else if (a.presence.type === "switch_off") spec.switchReact = { mode: "show", whenOn: false };

  // 이동 (behavior 통합)
  if (a.movement.type === "patrol") {
    spec.rules = [{ when: { type: "always" }, do: { type: "patrol", speed: a.movement.speed } }];
    // TODO(builder): g.endX/endY 경로 반영 — patrol 액션이 끝점 파라미터를 아직 안 받음
  }
  // TODO(builder): ride_start / ride_oneway — 대응 행동 미구현
  // TODO(builder): contactReaction fall/break — 타이머성 낙하·파괴 대응 미구현(breakBy는 머리치기 파괴라 다름)

  return spec;
}

type SlopeDir = "floor-asc" | "floor-desc" | "ceil-desc" | "ceil-asc";
function slopeShape(dir: SlopeDir, flip?: boolean): BlockSpec["shape"] {
  // floor-asc(◢)/floor-desc(◣)/ceil-desc(◥)/ceil-asc(◤) → BlockSpec shape. ⚠️ 렌더 규약과 맞는지 확인 필요.
  const base: Record<string, BlockSpec["shape"]> = {
    "floor-asc": "slopeNE", "floor-desc": "slopeNW", "ceil-desc": "ceilNE", "ceil-asc": "ceilNW",
  };
  let s = base[dir as string];
  if (flip) s = s === "slopeNE" ? "slopeNW" : s === "slopeNW" ? "slopeNE" : s === "ceilNE" ? "ceilNW" : "ceilNE";
  return s;
}

// =============================================================================
// 장애물 → BlockSpec (지형 아님 — faces 없음, 접촉효과 물성 위주)
// =============================================================================
export function buildObstacleBlock(id: string, a: ObstacleAttrs, g: BuildGeom): BlockSpec {
  const properties: PropSpec[] = [];
  const ce = a.contactEffect;
  if (ce.type === "damage") {
    const part = ce.zone === "all" ? "all" : ce.zone === "except_top" ? "notTop" : "bottomOnly";
    properties.push({ type: "damage", part });
  } else if (ce.type === "updraft") {
    properties.push({ type: "updraft" });
  }
  // TODO(builder): knockback 장애물 — 대응 물성 미구현(범퍼). 물성 추가 시 여기.
  if (a.togglesSwitch) properties.push({ type: "switchToggle" });

  const rules: RuleSpec[] = [];
  switch (a.motion.type) {
    case "spin": rules.push({ when: { type: "always" }, do: { type: "rotate", speed: a.motion.speed } }); break;
    case "pendulum": rules.push({ when: { type: "always" }, do: { type: "pendulum" } }); break;
    case "patrol": rules.push({ when: { type: "always" }, do: { type: "patrol", speed: a.motion.speed } }); break;
    case "charge":
      // best-effort: 아래 접근 시 돌진. 방향 down은 slamDown, 좌우는 chargeSide.
      rules.push({ when: { type: "always" }, do: { type: "idle" } });
      rules.push({
        when: { type: "playerWithin", dist: "near" },
        do: a.motion.dir === "down" ? { type: "slamDown" } : { type: "chargeSide", dir: a.motion.dir },
        priority: 1, windupMs: 400,
      });
      // TODO(builder): after(return/respawn/once) 반영
      break;
    case "none": break;
  }
  if (a.shooter) {
    // 주기 발사. TODO(builder): homing/stopNearPlayer 세부
    rules.push({
      when: { type: "periodic", ms: periodMs(a.shooter.period) },
      do: { type: "shoot", speed: a.shooter.speed, aim: a.shooter.aim },
    });
  }
  // TODO(builder): trigger periodic/proximity/switch 게이팅 — 위 rules를 조건으로 감싸야 함

  const spec: BlockSpec = { id, x: g.x, y: g.y, w: g.w, h: g.h };
  if (properties.length) spec.properties = properties;
  if (rules.length) spec.rules = rules;
  return spec;
}

// =============================================================================
// 몬스터 → MonsterSpec
// =============================================================================
export function buildMonster(id: string, asset: string, a: MonsterAttrs, g: BuildGeom): MonsterSpec {
  const rules: RuleSpec[] = [];

  // 이동 (기본 행동)
  switch (a.locomotion.type) {
    case "stationary": rules.push({ when: { type: "always" }, do: { type: "idle" } }); break;
    case "walk":
      rules.push({
        when: { type: "always" },
        do: { type: "patrol", speed: a.locomotion.speed, turnAtLedge: a.locomotion.cliff === "turn" },
      });
      break;
    case "fly": rules.push({ when: { type: "always" }, do: { type: "fly" } }); break;
    case "climb": rules.push({ when: { type: "always" }, do: { type: "crawlSurface" } }); break;
  }

  // 추적 (더 높은 우선순위로 덮어씀)
  const chaseSpeed = a.locomotion.type === "walk" ? a.locomotion.speed : "normal";
  switch (a.pursuit.type) {
    case "proximity":
      rules.push({ when: { type: "playerWithin", dist: a.pursuit.range }, do: { type: "chase", speed: chaseSpeed }, priority: 1 });
      break;
    case "always":
      rules.push({ when: { type: "always" }, do: { type: "chase", speed: chaseSpeed }, priority: 1 });
      break;
    case "sight":
      // 부끄부끄식: 보이면 정지, 안 보이면 기본 이동. inSight 조건 사용.
      rules.push({ when: { type: "inSight" }, do: { type: "idle" }, priority: 2 });
      break;
    case "jump_sync":
      break; // TODO(builder): 점프 동기화 행동 미구현
    case "none": break;
  }

  // 발사
  if (a.shooter) {
    rules.push({
      when: { type: "periodic", ms: periodMs(a.shooter.period) },
      do: { type: "shoot", aim: a.shooter.arc }, priority: 1,
    });
  }
  // 주기 도약
  if (a.hop) {
    rules.push({ when: { type: "periodic", ms: 1500 }, do: { type: "hop", power: powerNum(a.hop.height) }, priority: 1 });
  }
  // 분노: 밟히면 가속·추적 전환
  if (a.enrage) {
    rules.push({ when: { type: "stomped" }, do: { type: "enrage" }, priority: 3 });
  }
  // TODO(builder): splitOnDeath(죽음 훅 필요), shove(접촉→넉백 대응 미구현)

  const vuln = {
    stomp: stompReactionToVuln(a.stompReaction.type),
    invincible: a.immortal || undefined,
  };

  return {
    id, asset, x: g.x, y: g.y, w: g.w, h: g.h,
    rules, vuln, hp: a.hp, contactDamage: a.contactDamage,
  };
}

function stompReactionToVuln(r: MonsterAttrs["stompReaction"]["type"]): StompReaction {
  switch (r) {
    case "die": return "die";
    case "stun": return "stun";
    case "spiky": return "hurtAttacker";     // 밟기 불가 = 밟은 쪽 피해
    case "trampoline": return "trampoline";
  }
}
