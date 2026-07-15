// 시각 언어 파생 — 카테고리+attrs → { 면별 테두리, 오라, 오버레이 태그 }.
// docs/KJH/visual-language.md의 단일 소스. 클라 렌더(BaseworldScene)와 에디터 미리보기가 같이 사용.
// ⚠️ 여기는 "무엇을 표시할지" 파생만. 실제 그리기(테두리·발광·모션)는 렌더 계층 담당(미구현).
import type { AttrsByCategory, Category } from "../schemas/index.js";
import { collisionFaces } from "../schemas/platform.js";
import type { MonsterAttrs, ObstacleAttrs, PlatformAttrs } from "../schemas/index.js";

export type Face = "top" | "bottom" | "left" | "right";

/** 면 테두리 스타일 (visual-language.md §1.1) */
export type BorderStyle =
  | "solidWhite"    // 단단한 면(충돌)
  | "dashed"        // 통과 가능한 면
  | "red"           // 대미지 주는 면
  | "orange"        // 무적 상태의 대미지 면
  | "bumper"        // 넉백/밀쳐냄(무해) — 파랑/청록
  | "trampoline"    // 밟으면 튕김 이득 — 초록/스프링
  | "none";         // 표시 없음(밟기 가능한 몬스터 윗면 등)
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
    case "platform":
      return platformTags(attrs as PlatformAttrs);
    case "obstacle":
      return obstacleTags(attrs as ObstacleAttrs);
    case "monster":
      return monsterTags(attrs as MonsterAttrs);
    default:
      return { faces: faceMap("none"), auras: [], overlays: [] };
  }
}

/** 플랫폼: 충돌 면 = 흰 실선 / 나머지 = 점선. 대미지원 아님. */
function platformTags(a: PlatformAttrs): VisualTags {
  const solid = collisionFaces(a.collision); // { top,bottom,left,right: boolean }
  const faces = {} as FaceBorders;
  for (const f of ALL_FACES) faces[f] = solid[f] ? "solidWhite" : "dashed";

  const auras: AuraTag[] = [];
  if (a.presence.type === "switch_on" || a.presence.type === "switch_off") auras.push("switchAffected");

  const overlays: OverlayTag[] = [];
  if (a.slippery) overlays.push("ice");
  if (a.conveyor) overlays.push("conveyor");
  if (a.bouncy) overlays.push("bouncy");
  if (a.dash) overlays.push("dash");
  if (a.contactReaction.type === "fall" || a.contactReaction.type === "break") overlays.push("fallBreak");
  if (a.movement.type === "patrol") overlays.push("moving");
  if (a.movement.type === "ride_start" || a.movement.type === "ride_oneway") overlays.push("rideStart");
  if (a.presence.type === "blink") overlays.push("periodic");
  if (a.presence.type === "hidden") overlays.push("hiddenEditorOnly");
  return { faces, auras, overlays };
}

/** 장애물: 지형 아님(흰/점선 없음). 대미지 주는 면만 빨강, 넉백은 범퍼색. */
function obstacleTags(a: ObstacleAttrs): VisualTags {
  const faces = faceMap("none");
  const ce = a.contactEffect;
  if (ce.type === "damage") {
    const red = damageFaces(ce.zone); // zone → 어느 면이 빨강
    for (const f of ALL_FACES) if (red[f]) faces[f] = "red";
  } else if (ce.type === "knockback") {
    for (const f of ALL_FACES) faces[f] = "bumper"; // 무해 범퍼
  }
  // updraft = 무해 → 면 테두리 없음(오버레이 wind은 추후)

  const auras: AuraTag[] = [];
  if (a.togglesSwitch) auras.push("switchToggler");
  if (a.trigger.type === "switch") auras.push("switchAffected");

  const overlays: OverlayTag[] = [];
  if (a.motion.type === "charge") overlays.push("charge");
  else if (a.motion.type !== "none") overlays.push("moving"); // spin/pendulum/patrol
  if (a.trigger.type === "periodic") overlays.push("periodic");
  if (a.trigger.type === "proximity") overlays.push("proximity");
  if (a.shooter) overlays.push("shooter");
  return { faces, auras, overlays };
}

/** 몬스터: 기본 위 빼고 빨강. 가시=위도 빨강, 트램펄린=위 초록, 무적=빨강→주황, 밀쳐냄=범퍼. */
function monsterTags(a: MonsterAttrs): VisualTags {
  const faces = faceMap("none");
  const hazardStyle: BorderStyle = a.shove ? "bumper" : a.immortal ? "orange" : "red"; // 밀쳐냄 무해 우선

  if (a.contactDamage || a.shove) {
    // 옆·아래 = 위험 표시
    faces.bottom = hazardStyle;
    faces.left = hazardStyle;
    faces.right = hazardStyle;
    // 윗면: 밟기 반응에 따라
    if (a.stompReaction.type === "spiky") faces.top = hazardStyle;      // 밟아도 당함 → 위도 위험색
    else if (a.stompReaction.type === "trampoline") faces.top = "trampoline"; // 밟으면 이득
    else faces.top = "none";                                            // die/stun = 밟기 가능
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
