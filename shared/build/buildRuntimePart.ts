// attrs → 런타임 파츠 조립기 (§빌더). "유저가 고른 옵션(attrs)"을 실제 게임 오브젝트(BlockSpec/MonsterSpec)로.
// 지금까진 testmap이 손으로 스펙을 박았음 — 이 파일이 그 다리. 에디터 배치·게임 인스턴스화가 이걸 통해 만든다.
//
// 입력: 카테고리 + attrs(스키마 검증본) + geom(px 좌표/크기 + flipX + patrol 끝점).
// 출력: BlockSpec | MonsterSpec (parts). 행동은 프리셋 문자열을 그대로(액션이 내부 변환), 물성만 숫자.
//
// 2026-07-15: knockback·trigger 게이팅·ride_start/ride_oneway·contactReaction(fall/break)·
// shove·splitOnDeath 전부 구현 완료. 남은 TODO(builder) — anchor(돌진 후 복귀)·explode(폭발 판정)·
// jump_sync(점프 동기화 추적)·발사 유도(homing 조준) — 이들은 해당 행동이 생기면 채운다.
import { TUNING } from "../physics/tuning.js";
import type { Faces } from "../physics/terrain.js";
import { speedPreset } from "../behavior/helpers.js";
import { collisionFaces } from "../schemas/block.js";
import type { BlockAttrs, MonsterAttrs, Power2, Period3 } from "../schemas/index.js";
import type { BlockSpec } from "../parts/block.js";
import type { MonsterSpec, StompReaction } from "../parts/monster.js";
import type { RuleSpec, CondSpec } from "../behavior/types.js";

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

/** 블록 trigger → 발동 조건. always는 게이팅 없음(null). §A-5 */
function triggerCondition(trig: BlockAttrs["trigger"]): CondSpec | null {
  switch (trig.type) {
    case "always": return null;
    case "periodic": return { type: "periodicWindow", ms: periodMs(trig.period) };
    case "proximity": return { type: "playerWithin", axis: trig.axis, dist: trig.range };
    case "switch": return { type: "switchState", on: true };
  }
}

// =============================================================================
// 플랫폼 → BlockSpec
// =============================================================================
export function buildBlock(id: string, a: BlockAttrs, g: BuildGeom): BlockSpec {
  let faces = collisionFaces(a.collision) as Faces;
  if (g.flipX) faces = flipFaces(faces);

  const properties: PropSpec[] = [];
  if (a.contactEffect.type === "damage") {
    const z = a.contactEffect.zone;
    properties.push({ type: "damage", part: z === "all" ? "all" : z === "except_top" ? "notTop" : "bottomOnly" });
  } else if (a.contactEffect.type === "updraft") {
    properties.push({ type: "updraft" });
  } else if (a.contactEffect.type === "knockback") {
    properties.push({ type: "knockback", power: powerNum(a.contactEffect.power) });
  }
  if (a.slippery) properties.push({ type: "ice" });
  if (a.conveyor) {
    const dir = g.flipX ? flipDir(a.conveyor.dir) : a.conveyor.dir;
    properties.push({ type: "conveyor", dir, speed: speedPreset(a.conveyor.speed, TUNING) });
  }
  if (a.bouncy) properties.push({ type: "trampoline", power: powerNum(a.bouncy.power) });
  if (a.dash) properties.push({ type: "dash" });
  if (a.togglesSwitch) properties.push({ type: "switchToggle" });

  const spec: BlockSpec = { id, x: g.x, y: g.y, w: g.w, h: g.h, faces };
  if (properties.length) spec.properties = properties;

  if (a.shape.type === "slope") spec.shape = slopeShape(a.shape.dir, g.flipX);

  if (a.presence.type === "hidden") spec.visibility = "hidden";
  else if (a.presence.type === "blink") { spec.visibility = "blink"; spec.blinkMs = periodMs(a.presence.period); }
  else if (a.presence.type === "switch_on") spec.switchReact = { mode: "show", whenOn: true };
  else if (a.presence.type === "switch_off") spec.switchReact = { mode: "show", whenOn: false };

  // 이동·동작 (behavior 통합). trigger가 "항상 켜진" 이동(patrol/spin/pendulum)의 활성 조건을 게이팅
  // — charge는 자체 playerWithin 발동 조건이 이미 있어 별개(trigger 미적용).
  const triggerGate = triggerCondition(a.trigger);
  const rules: RuleSpec[] = [];
  switch (a.motion.type) {
    case "patrol": rules.push({ when: triggerGate ?? { type: "always" }, do: { type: "patrol", speed: a.motion.speed } }); break;
    case "spin": rules.push({ when: triggerGate ?? { type: "always" }, do: { type: "rotate", speed: a.motion.speed } }); break;
    case "pendulum": rules.push({ when: triggerGate ?? { type: "always" }, do: { type: "pendulum" } }); break;
    case "charge":
      rules.push({ when: { type: "always" }, do: { type: "idle" } });
      rules.push({
        when: { type: "playerWithin", dist: "near" },
        do: a.motion.dir === "down" ? { type: "slamDown" } : { type: "chargeSide", dir: a.motion.dir },
        priority: 1, windupMs: 400,
      });
      break;
    case "ride_start":
      rules.push({ when: { type: "ridden" }, do: { type: "shuttle", speed: "normal", endX: g.endX ?? g.x, endY: g.endY ?? g.y } });
      break;
    case "ride_oneway":
      rules.push({ when: { type: "ridden" }, do: { type: "rideOneway", sink: a.motion.sink, speed: "normal", endX: g.endX ?? g.x, endY: g.endY ?? g.y } });
      break;
  }
  if (a.shooter) {
    rules.push({ when: { type: "periodic", ms: periodMs(a.shooter.period) }, do: { type: "shoot", speed: a.shooter.speed, aim: a.shooter.aim } });
  }
  if (a.contactReaction.type === "fall" || a.contactReaction.type === "break") {
    rules.push({
      when: { type: "ridden" },
      do: { type: a.contactReaction.type === "fall" ? "crumbleFall" : "crumbleBreak", senseFaces: a.contactReaction.senseFaces },
      priority: 2,
    });
  }
  if (rules.length) spec.rules = rules;

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
      rules.push({ when: { type: "inSight" }, do: { type: "idle" }, priority: 2 }); // 부끄부끄
      break;
    case "flee":
      rules.push({ when: { type: "playerWithin", dist: a.pursuit.range }, do: { type: "flee", speed: chaseSpeed }, priority: 1 });
      break;
    case "jump_sync":
      break; // TODO(builder): 점프 동기화 행동 미구현
    case "none": break;
  }

  // 발사 — trigger 게이팅(주기/근접/시야)
  if (a.shooter) {
    const s = a.shooter;
    const when: RuleSpec["when"] = s.trigger === "proximity" ? { type: "playerWithin", dist: s.range }
      : s.trigger === "sight" ? { type: "inSight" }
      : { type: "periodic", ms: periodMs(s.period) };
    rules.push({ when, do: { type: "shoot", aim: s.arc }, priority: 1 });
  }
  // 주기 도약
  if (a.hop) {
    rules.push({ when: { type: "periodic", ms: 1500 }, do: { type: "hop", power: powerNum(a.hop.height) }, priority: 1 });
  }
  // 분노
  if (a.enrage) rules.push({ when: { type: "stomped" }, do: { type: "enrage" }, priority: 3 });
  // 잠복→등장 / 순간이동 — best-effort(기존 ambush/teleportTo)
  if (a.emerge) {
    const when: RuleSpec["when"] = a.emerge.trigger === "proximity"
      ? { type: "playerWithin", dist: a.emerge.range } : { type: "periodic", ms: periodMs(a.emerge.period) };
    rules.push({ when, do: { type: "ambush" }, priority: 2 });
  }
  if (a.teleport) {
    const when: RuleSpec["when"] = a.teleport.trigger === "on_hit"
      ? { type: "hit" } : { type: "periodic", ms: periodMs(a.teleport.period) };
    rules.push({ when, do: { type: "teleportTo" }, priority: 2 });
  }
  // TODO(builder): anchor(돌진 후 복귀)·explode 액션 — 미구현

  const vuln = {
    stomp: stompReactionToVuln(a.stompReaction.type),
    invincible: a.immortal || undefined,
  };

  return {
    id, asset, x: g.x, y: g.y, w: g.w, h: g.h,
    rules, vuln, hp: a.hp, contactDamage: a.contactDamage,
    shove: a.shove || undefined,
    splitOnDeath: a.splitOnDeath || undefined,
  };
}

function stompReactionToVuln(r: MonsterAttrs["stompReaction"]["type"]): StompReaction {
  switch (r) {
    case "die": return "die";
    case "stun": return "stun";
    case "spiky": return "hurtAttacker";     // 밟기 불가 = 밟은 쪽 피해
    case "trampoline": return "trampoline";
    case "shell": return "shellify";         // 엉금 → 껍질
    case "explode": return "die";            // TODO(builder): explode 액션 미구현 — 우선 die
  }
}
