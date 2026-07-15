// 매니페스트가 (1) deriveActions로 정상 액션 세트를 뽑는지, (2) BlockAttrs/MonsterAttrs의
// 모든 discriminated union 값·불리언을 최소 1회 실제로 커버하는지 코드로 검증(손으로 센 표 대신).
import { deriveActions } from "../../shared/actions/index.js";
import { ASSETS } from "../../asset-sources/manifest.mjs";

let problems = 0;

// ---- 1) 액션 파생 결과 확인 (0개면 문제) ----
console.log("=== 액션 파생 결과 ===");
for (const a of ASSETS) {
  const actions = deriveActions(a.category, a.attrs);
  // background는 2026-07-16부로 액션 0개가 정상(AI 생성 자체를 안 함) — derive.ts 주석 참조.
  if (actions.length === 0 && a.category !== "background") {
    console.error(`❌ ${a.id}: 액션 0개`);
    problems++;
  }
  if (actions.length !== 0 && a.category === "background") {
    console.error(`❌ ${a.id}: background인데 액션이 생김(0개여야 함)`);
    problems++;
  }
}
console.log(`(${ASSETS.length}개 전부 액션 파생 확인 완료)\n`);

// ---- 2) 몬스터 옵션 전수 커버 ----
const monsters = ASSETS.filter((a) => a.category === "monster").map((a) => a.attrs);
function coverage(name, values, expected) {
  const seen = new Set(values);
  const missing = expected.filter((e) => !seen.has(e));
  if (missing.length) { console.error(`❌ ${name} 미커버:`, missing); problems++; }
  else console.log(`✅ ${name} 전수 커버 (${expected.length}종)`);
}
coverage("locomotion.type", monsters.map((m) => m.locomotion.type), ["stationary", "walk", "climb", "fly"]);
coverage("pursuit.type", monsters.map((m) => m.pursuit.type), ["none", "proximity", "always", "sight", "jump_sync", "flee"]);
coverage("stompReaction.type", monsters.map((m) => m.stompReaction.type), ["die", "stun", "spiky", "trampoline", "shell", "explode"]);
coverage("hp", monsters.map((m) => m.hp), [1, 2, 3]);
coverage("shooter.arc(존재하는 것만)", monsters.filter((m) => m.shooter).map((m) => m.shooter.arc), ["straight", "arc", "homing"]);
coverage("불리언 true 존재", [
  monsters.some((m) => m.contactDamage === false) ? "contactDamage:false" : null,
  monsters.some((m) => m.anchor) ? "anchor" : null,
  monsters.some((m) => m.enrage) ? "enrage" : null,
  monsters.some((m) => m.splitOnDeath) ? "splitOnDeath" : null,
  monsters.some((m) => m.immortal) ? "immortal" : null,
  monsters.some((m) => m.shove) ? "shove" : null,
  monsters.some((m) => m.hop) ? "hop" : null,
  monsters.some((m) => m.emerge) ? "emerge" : null,
  monsters.some((m) => m.teleport) ? "teleport" : null,
].filter(Boolean), ["contactDamage:false", "anchor", "enrage", "splitOnDeath", "immortal", "shove", "hop", "emerge", "teleport"]);

// ---- 3) 블록 옵션 전수 커버 ----
const blocks = ASSETS.filter((a) => a.category === "block").map((a) => a.attrs);
coverage("collision.type", blocks.map((b) => b.collision.type), ["full", "top_only", "faces", "none"]);
coverage("shape.type", blocks.map((b) => b.shape.type), ["rect", "slope"]);
coverage("presence.type", blocks.map((b) => b.presence.type), ["always", "hidden", "switch_on", "switch_off", "blink"]);
coverage("motion.type", blocks.map((b) => b.motion.type), ["none", "patrol", "ride_start", "ride_oneway", "spin", "pendulum", "charge"]);
coverage("contactEffect.type", blocks.map((b) => b.contactEffect.type), ["none", "damage", "knockback", "updraft"]);
coverage("contactEffect damage.zone(존재하는 것만)", blocks.filter((b) => b.contactEffect.type === "damage").map((b) => b.contactEffect.zone), ["all", "except_top", "bottom_only"]);
coverage("contactReaction.type", blocks.map((b) => b.contactReaction.type), ["none", "fall", "break"]);
coverage("trigger.type", blocks.map((b) => b.trigger.type), ["always", "periodic", "proximity", "switch"]);
coverage("불리언/nullable 존재", [
  blocks.some((b) => b.slippery) ? "slippery" : null,
  blocks.some((b) => b.conveyor) ? "conveyor" : null,
  blocks.some((b) => b.bouncy) ? "bouncy" : null,
  blocks.some((b) => b.dash) ? "dash" : null,
  blocks.some((b) => b.shooter) ? "shooter" : null,
  blocks.some((b) => b.harmMonsters) ? "harmMonsters" : null,
  blocks.some((b) => b.breakBlocks) ? "breakBlocks" : null,
  blocks.some((b) => b.togglesSwitch) ? "togglesSwitch" : null,
].filter(Boolean), ["slippery", "conveyor", "bouncy", "dash", "shooter", "harmMonsters", "breakBlocks", "togglesSwitch"]);
coverage("shooter.aim(존재하는 것만)", blocks.filter((b) => b.shooter).map((b) => b.shooter.aim), ["straight", "homing"]);
coverage("slope dir(존재하는 것만)", blocks.filter((b) => b.shape.type === "slope").map((b) => b.shape.dir), ["floor-asc", "floor-desc", "ceil-desc", "ceil-asc"]);

console.log(problems === 0 ? "\n✅ 전부 통과 — 모든 옵션 실제 활용 확인" : `\n❌ ${problems}건 문제 발견`);
process.exit(problems === 0 ? 0 : 1);
