// 시각 언어 파생 — 카테고리+attrs → { 면별 테두리, 오라, 오버레이 태그 }.
// docs/KJH/visual-language.md의 단일 소스. 클라 렌더(BaseworldScene)와 에디터 미리보기가 같이 사용.
// ⚠️ 여기는 "무엇을 표시할지" 파생만. 실제 그리기(테두리·발광·모션)는 렌더 계층 담당(미구현).
import type { AttrsByCategory, Category } from "../schemas/index.js";
import { collisionFaces } from "../schemas/block.js";
import type { BlockAttrs, MonsterAttrs } from "../schemas/index.js";

export type Face = "top" | "bottom" | "left" | "right";

/**
 * 면 테두리 스타일 (visual-language.md §1.1).
 * ⚠️ "무적 상태의 대미지 면(주황)"은 별도 스타일로 두지 않는다 — 렌더 시점에 "빨강"을
 * "solidWhite"로 치환하는 방식으로 통일(2026-07-15, BaseworldScene.strokeFace 참조).
 * 새 색을 늘리지 않고 기존 "안전" 의미를 재사용하는 쪽이 더 명확하다는 실사용 피드백.
 */
export type BorderStyle =
  | "solidWhite"    // 단단한 면(충돌) · 위험이 사라진 면(무적 중 등)
  | "dashed"        // 통과 가능한 면
  | "red"           // 대미지 주는 면
  | "bumper"        // 넉백/밀쳐냄(무해) — 파랑/청록
  | "trampoline"    // 밟으면 튕김 이득 — 초록/스프링
  | "none";         // 표시 없음
export type FaceBorders = Record<Face, BorderStyle>;

/** 전체 오라·소속 (§1.2). player는 렌더가 isSelf로 회색/흰색 결정 */
export type AuraTag =
  | "playerSelf" | "playerOther"
  | "switchToggler" | "switchAffected"
  | "itemGiver" | "item"
  | "backgroundLayer";

/** 맥락 표시(근접/hover/에디터) (§2) */
export type OverlayTag =
  | "conveyor" | "ice" | "bouncy" | "dash" | "fallBreak"           // 표면
  | "moving" | "charge" | "periodic" | "proximity" | "rideStart"   // 텔레그래프
  | "hpPips" | "enrage" | "split" | "shooter"                      // 상태
  | "hiddenEditorOnly";

export interface VisualTags {
  /** 면별 테두리. 면 개념이 없는 대상(아이템·배경)은 null */
  faces: FaceBorders | null;
  auras: AuraTag[];
  overlays: OverlayTag[];
}

const ALL_FACES: Face[] = ["top", "bottom", "left", "right"];
function faceMap(fill: BorderStyle): FaceBorders {
  return { top: fill, bottom: fill, left: fill, right: fill };
}

export interface VisualOpts {
  /** 아바타일 때 내 것인지(회색) 남의 것인지(흰색) — 런타임 결정 */
  isSelf?: boolean;
}

export function deriveVisualTags<C extends Category>(
  category: C,
  attrs: AttrsByCategory[C],
  opts: VisualOpts = {},
): VisualTags {
  switch (category) {
    case "avatar":
      return { faces: faceMap("solidWhite"), auras: [opts.isSelf ? "playerSelf" : "playerOther"], overlays: [] };
    case "item":
      return { faces: null, auras: ["item"], overlays: [] };
    case "background":
      return { faces: null, auras: ["backgroundLayer"], overlays: [] };
    case "block":
      return blockTags(attrs as BlockAttrs);
    case "monster":
      return monsterTags(attrs as MonsterAttrs);
    default:
      return { faces: faceMap("none"), auras: [], overlays: [] };
  }
}

/** 블록(구 platform+obstacle): 충돌 면 = 흰 실선/점선, 대미지 면은 빨강, 넉백 범퍼로 덮어씀. */
function blockTags(a: BlockAttrs): VisualTags {
  const solid = collisionFaces(a.collision);
  const faces = {} as FaceBorders;
  for (const f of ALL_FACES) faces[f] = solid[f] ? "solidWhite" : "dashed";

  // 접촉 효과가 충돌 테두리를 덮어씀 (해당 면)
  const ce = a.contactEffect;
  if (ce.type === "damage") {
    const red = damageFaces(ce.zone);
    for (const f of ALL_FACES) if (red[f]) faces[f] = "red";
  } else if (ce.type === "knockback") {
    for (const f of ALL_FACES) faces[f] = "bumper";
  }

  const auras: AuraTag[] = [];
  if (a.presence.type === "switch_on" || a.presence.type === "switch_off" || a.trigger.type === "switch") auras.push("switchAffected");
  if (a.togglesSwitch) auras.push("switchToggler");

  const overlays: OverlayTag[] = [];
  if (a.slippery) overlays.push("ice");
  if (a.conveyor) overlays.push("conveyor");
  if (a.bouncy) overlays.push("bouncy");
  if (a.dash) overlays.push("dash");
  if (a.contactReaction.type === "fall" || a.contactReaction.type === "break") overlays.push("fallBreak");
  if (a.motion.type === "charge") overlays.push("charge");
  else if (a.motion.type === "patrol" || a.motion.type === "spin" || a.motion.type === "pendulum") overlays.push("moving");
  else if (a.motion.type === "ride_start" || a.motion.type === "ride_oneway") overlays.push("rideStart");
  if (a.presence.type === "blink" || a.trigger.type === "periodic") overlays.push("periodic");
  if (a.presence.type === "hidden") overlays.push("hiddenEditorOnly");
  if (a.trigger.type === "proximity") overlays.push("proximity");
  if (a.shooter) overlays.push("shooter");
  return { faces, auras, overlays };
}

/**
 * 몬스터: 기본 위 빼고 빨강. 트램펄린=위 초록, 밀쳐냄=범퍼. 무적(주황)은 그리지 않음 —
 * 주황은 "지금 나(플레이어)가 무적이라 안전함"만 의미(런타임 렌더의 iAmInvincible 전환) —
 * 몬스터의 immortal/spiky는 처치 가능 여부일 뿐 접촉 위험과 무관하므로 orange로 매핑하지 않는다.
 * spiky(가시)를 위도 위험색으로 그리던 것도 제거 — 실제 스톰프 처리가 vuln.stomp(spiky→
 * hurtAttacker)를 전혀 읽지 않아(§deriveVisualTagsFromSpec.ts 주석 참조) "밟으면 반격"이
 * 구현돼 있지 않다. 밟기는 항상 안전하게 튕겨나가므로 위는 항상 solidWhite(트램펄린 제외).
 */
function monsterTags(a: MonsterAttrs): VisualTags {
  const faces = faceMap("solidWhite");
  const hazardStyle: BorderStyle = a.shove ? "bumper" : "red";

  if (a.contactDamage || a.shove) {
    // 옆·아래 = 위험 표시
    faces.bottom = hazardStyle;
    faces.left = hazardStyle;
    faces.right = hazardStyle;
    if (a.stompReaction.type === "trampoline") faces.top = "trampoline"; // 밟으면 이득
    // else: 밟기 가능 = solidWhite 유지(spiky 포함 — 반격 미구현)
  } else if (a.stompReaction.type === "trampoline") {
    faces.top = "trampoline";
  }

  const overlays: OverlayTag[] = [];
  if (a.hp > 1) overlays.push("hpPips");
  if (a.enrage) overlays.push("enrage");
  if (a.splitOnDeath) overlays.push("split");
  if (a.shooter) overlays.push("shooter");
  if (a.locomotion.type === "walk" && a.locomotion.speed !== "slow") overlays.push("moving");
  return { faces, auras: [], overlays };
}

/** 장애물 zone(all/except_top/bottom_only) → 빨강 면 집합 */
function damageFaces(zone: "all" | "except_top" | "bottom_only"): Record<Face, boolean> {
  switch (zone) {
    case "all": return { top: true, bottom: true, left: true, right: true };
    case "except_top": return { top: false, bottom: true, left: true, right: true }; // 밟기 가능
    case "bottom_only": return { top: false, bottom: true, left: false, right: false }; // 고드름
  }
}
