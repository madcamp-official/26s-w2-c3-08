// 몬스터 파츠 (§51·§21): 조건→행동 규칙 + 취약성 + HP 타격집합 + 무적프레임.
// 위치·어그로 = 서버 권위. 죽음 = 밟은 클라 확정 → relay(멱등).
import { TUNING, type Tuning } from "../physics/tuning.js";
import { type Body, createBody } from "../physics/body.js";
import type { RuleSpec } from "../behavior/types.js";
import { compileRules, stepRules, type CompiledRule } from "../behavior/evaluate.js";
import type { Ctx } from "../behavior/types.js";
import type { Terrain } from "../physics/terrain.js";

export type StompReaction = "die" | "shellify" | "stun" | "hurtAttacker" | "trampoline";

export interface VulnSpec {
  stomp: StompReaction;
  pound?: StompReaction;
  shell?: boolean;      // 껍질에 죽나
  explosion?: boolean;
  invincible?: boolean; // 환경형 (켜면 전부 무효)
}

export interface MonsterSpec {
  id: string;
  asset: string;
  x: number; y: number; w: number; h: number;
  rules: RuleSpec[];
  vuln: VulnSpec;
  hp: number;               // 처치에 필요한 독립 타격 수 (§21-3)
  contactDamage?: boolean;  // 기본 T
}

export interface MonsterInstance {
  spec: MonsterSpec;
  body: Body;
  alive: boolean;
  respawnLeftMs: number;
  hits: Set<string>;         // 타격 이벤트 집합 (멱등)
  iframeLeftMs: number;      // 무적 프레임 (서버 판정 §21-3)
  rules: CompiledRule[];
  mem: Record<string, number>;
  events: Set<string>;
  targetId: string | null;   // 어그로 (0.5초 히스테리시스)
  aggroSwitchLeftMs: number;
}

export function createMonster(spec: MonsterSpec): MonsterInstance {
  return {
    spec,
    body: createBody(spec.x, spec.y, spec.w, spec.h, ["monster"]),
    alive: true, respawnLeftMs: 0,
    hits: new Set(), iframeLeftMs: 0,
    rules: compileRules(spec.rules),
    mem: {}, events: new Set(),
    targetId: null, aggroSwitchLeftMs: 0,
  };
}

/** 서버: 어그로 대상 갱신 (가장 가까운 놈, 0.5초 뒤 전환 §21-1) */
export function updateAggro(
  m: MonsterInstance, players: Map<string, Body>, dtMs: number, t: Tuning = TUNING,
): Body | null {
  let nearestId: string | null = null, nd = Infinity;
  for (const [id, p] of players) {
    const d = Math.hypot(p.x - m.body.x, p.y - m.body.y);
    if (d < nd) { nd = d; nearestId = id; }
  }
  if (nearestId !== m.targetId) {
    m.aggroSwitchLeftMs -= dtMs;
    if (m.aggroSwitchLeftMs <= 0 || m.targetId === null) {
      m.targetId = nearestId;
      m.aggroSwitchLeftMs = t.monster.aggroSwitchMs;
    }
  } else {
    m.aggroSwitchLeftMs = t.monster.aggroSwitchMs;
  }
  return m.targetId ? players.get(m.targetId) ?? null : null;
}

/** 서버: 타격 등록 (집합 병합 = 멱등·순서무관). true = 죽음 확정 */
export function registerHit(m: MonsterInstance, hitId: string, t: Tuning = TUNING): boolean {
  if (!m.alive || m.spec.vuln.invincible) return false;
  if (m.iframeLeftMs > 0) return false;      // 무적 프레임 (서버가 지연 고려 판정)
  if (m.hits.has(hitId)) return false;       // 멱등
  m.hits.add(hitId);
  m.iframeLeftMs = t.monster.iframeMs;
  if (m.hits.size >= m.spec.hp) {
    m.alive = false;
    m.respawnLeftMs = t.rules.respawnMs;
    return true;
  }
  m.events.add("hit");
  return false;
}

/** 서버: 매 틱 몬스터 갱신 (behavior + 기절 + 재생성) */
export function stepMonster(
  m: MonsterInstance, target: Body | null, players: Body[],
  terrain: Terrain, dtMs: number, rng: () => number, switchOn: boolean,
  emit: (kind: string, data: Record<string, unknown>) => void, t: Tuning = TUNING,
): void {
  if (!m.alive) {
    m.respawnLeftMs -= dtMs;
    if (m.respawnLeftMs <= 0) {
      m.alive = true; m.hits.clear(); m.body.x = m.spec.x; m.body.y = m.spec.y;
      m.body.vx = 0; m.body.vy = 0; m.mem = {};
      // 재생성 유예(§iframe 재사용): 등장 즉시 타격/접촉 피해 없음 — registerHit이 이미 검사.
      // 접촉 피해는 클라 로컬 판정이라 emit("respawn")으로 서버가 graceEndsAt을 실어 클라에 알린다.
      m.iframeLeftMs = t.monster.respawnGraceMs;
      emit("respawn", { id: m.spec.id, graceMs: t.monster.respawnGraceMs });
    }
    return;
  }
  m.iframeLeftMs = Math.max(0, m.iframeLeftMs - dtMs);
  // 기절 중이면 행동 정지
  if ((m.mem["__stunLeft"] ?? 0) > 0) {
    m.mem["__stunLeft"] = (m.mem["__stunLeft"] ?? 0) - dtMs;
    m.body.vx = 0;
  } else {
    const ctx: Ctx = {
      self: m.body, dtMs, t, terrain, players, target,
      rng, mem: m.mem, events: m.events, emit,
      switchOn, hpRatio: 1 - m.hits.size / m.spec.hp,
    };
    stepRules(m.rules, ctx);
  }
  m.events.clear();
}
