// 런타임 스펙(BlockSpec/MonsterSpec) 기반 시각 언어 파생 — deriveVisualTags.ts의 attrs 기반 버전과
// 짝을 이룬다. 테스트맵처럼 attrs 없이 손으로 쓴 스펙에서 직접 태그를 뽑아야 렌더가 가능하므로 별도 함수.
// ⚠️ 스펙에 실제로 존재하는 정보만 파생한다 — buildRuntimePart.ts의 TODO(builder) 미구현 옵션
// (knockback 물성·contactReaction fall/break·ride_start·splitOnDeath 등)은 여기서도 표시하지 않는다
// (없는 기능을 있는 것처럼 그리지 않기 위함). visual-language.md §1(항상 표시)만 대상 — §2(맥락 표시)는 범위 밖.
import type { BlockSpec } from "../parts/block.js";
import type { MonsterSpec } from "../parts/monster.js";
import type { Faces } from "../physics/terrain.js";
import type { AuraTag, BorderStyle, Face, FaceBorders, OverlayTag, VisualTags } from "./deriveVisualTags.js";

const ALL_FACES: Face[] = ["top", "bottom", "left", "right"];
function faceMap(fill: BorderStyle): FaceBorders {
  return { top: fill, bottom: fill, left: fill, right: fill };
}

function propOf(spec: BlockSpec, type: string): { type: string; [k: string]: unknown } | undefined {
  return spec.properties?.find((p) => p.type === type);
}
function hasRuleAction(rules: { do: { type: string } }[] | undefined, type: string): boolean {
  return !!rules?.some((r) => r.do.type === type);
}

/** 블록 스펙 → 시각 태그 (§1 항상 표시만) */
export function blockVisualTagsFromSpec(spec: BlockSpec): VisualTags {
  const solid: Faces = spec.faces ?? { top: true, bottom: true, left: true, right: true };
  const faces = {} as FaceBorders;
  for (const f of ALL_FACES) faces[f] = solid[f] ? "solidWhite" : "dashed";

  const damage = propOf(spec, "damage");
  if (damage) {
    const part = damage.part as "all" | "notTop" | "bottomOnly" | undefined;
    const red: Record<Face, boolean> =
      part === "bottomOnly" ? { top: false, bottom: true, left: false, right: false }
      : part === "notTop" ? { top: false, bottom: true, left: true, right: true }
      : { top: true, bottom: true, left: true, right: true };
    for (const f of ALL_FACES) if (red[f]) faces[f] = "red";
  }
  // knockback 물성은 buildRuntimePart.ts TODO(builder) — 런타임에 없으므로 bumper 파생 안 함

  const auras: AuraTag[] = [];
  if (spec.switchReact) auras.push("switchAffected");
  if (propOf(spec, "switchToggle")) auras.push("switchToggler");

  const overlays: OverlayTag[] = [];
  if (propOf(spec, "ice")) overlays.push("ice");
  if (propOf(spec, "conveyor")) overlays.push("conveyor");
  if (propOf(spec, "trampoline")) overlays.push("bouncy");
  if (propOf(spec, "dash")) overlays.push("dash");
  if (hasRuleAction(spec.rules, "patrol") || hasRuleAction(spec.rules, "rotate") || hasRuleAction(spec.rules, "pendulum")) overlays.push("moving");
  if (hasRuleAction(spec.rules, "chargeSide") || hasRuleAction(spec.rules, "slamDown")) overlays.push("charge");
  if (spec.visibility === "blink") overlays.push("periodic");
  if (spec.visibility === "hidden") overlays.push("hiddenEditorOnly");
  if (hasRuleAction(spec.rules, "shoot")) overlays.push("shooter");

  return { faces, auras, overlays };
}

/** 몬스터 스펙 → 시각 태그 (§1 항상 표시만) */
export function monsterVisualTagsFromSpec(spec: MonsterSpec): VisualTags {
  const contactDamage = spec.contactDamage ?? true;
  const shove = hasRuleAction(spec.rules, "knockbackPlayer");   // §shove는 buildRuntimePart TODO — 등록된 행동명 기준 방어적 탐지
  const hazardStyle: BorderStyle = shove ? "bumper" : spec.vuln.invincible ? "orange" : "red";

  const faces = faceMap("none");
  if (contactDamage || shove) {
    faces.bottom = hazardStyle; faces.left = hazardStyle; faces.right = hazardStyle;
    if (spec.vuln.stomp === "hurtAttacker") faces.top = hazardStyle;       // 가시(spiky)
    else if (spec.vuln.stomp === "trampoline") faces.top = "trampoline";
    else faces.top = "none";
  } else if (spec.vuln.stomp === "trampoline") {
    faces.top = "trampoline";
  }

  const overlays: OverlayTag[] = [];
  if (spec.hp > 1) overlays.push("hpPips");
  if (hasRuleAction(spec.rules, "enrage")) overlays.push("enrage");
  if (hasRuleAction(spec.rules, "shoot")) overlays.push("shooter");
  if (hasRuleAction(spec.rules, "patrol")) overlays.push("moving");

  return { faces, auras: [], overlays };
}
