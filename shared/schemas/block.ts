// 블록 attrs — platform+obstacle 통합 카테고리(2026-07-14). 런타임은 이미 §44 BlockSpec 하나였고,
// 카테고리(유저가 고르는 종류)도 하나로 합침. 지형(단단)~해저드(관통·대미지)~장치(이동·발사)를 한 스키마로.
import { z } from "zod";
import { FacesAttr, Period3, Power2, Range3, SizeCells, Speed3 } from "./presets.js";

/** 접촉 판정 부위 — contactEffect가 damage일 때 어느 면 */
const HitZone = z.enum(["all", "except_top", "bottom_only"]);

/** [택1] 충돌 방식 — none = 관통 해저드(구 obstacle) */
const Collision = z.discriminatedUnion("type", [
  z.object({ type: z.literal("full") }),
  z.object({ type: z.literal("top_only") }),
  z.object({ type: z.literal("faces"), faces: FacesAttr }),
  z.object({ type: z.literal("none") }),
]);

/** [택1] 모양 */
const Shape = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rect") }),
  z.object({ type: z.literal("slope"), dir: z.enum(["floor-asc", "floor-desc", "ceil-desc", "ceil-asc"]) }),
]);

/** [택1] 실체화 조건 */
const Presence = z.discriminatedUnion("type", [
  z.object({ type: z.literal("always") }),
  z.object({ type: z.literal("hidden") }),
  z.object({ type: z.literal("switch_on") }),
  z.object({ type: z.literal("switch_off") }),
  z.object({ type: z.literal("blink"), period: Period3 }),
]);

/** [택1] 이동·동작 (구 platform.movement + obstacle.motion 통합, patrol 중복 제거) */
const Motion = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("patrol"), speed: Speed3 }),
  z.object({ type: z.literal("ride_start") }),
  z.object({ type: z.literal("ride_oneway"), sink: z.boolean() }),
  z.object({ type: z.literal("spin"), speed: Speed3, radius: Range3 }),
  // radius(진자 줄 길이 프리셋) — 2026-07-16 추가. default로 기존 저장 attrs({type:"pendulum"})도 유효 유지.
  z.object({ type: z.literal("pendulum"), radius: Range3.default("normal") }),
  z.object({ type: z.literal("charge"), dir: z.enum(["down", "left", "right"]), after: z.enum(["return", "respawn", "once"]) }),
]);

/** [택1] 접촉 효과 — 플레이어에게. none = 무해(지형) */
const ContactEffect = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("damage"), zone: HitZone }),
  z.object({ type: z.literal("knockback"), power: Power2 }),   // 무해 범퍼
  z.object({ type: z.literal("updraft") }),                    // 무해 상승기류
]);

/** [택1] 접촉 반응 — 블록 자신 (밟으면 n초 후 낙하/파괴) */
const ContactReaction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("fall"), senseFaces: FacesAttr }),
  z.object({ type: z.literal("break"), senseFaces: FacesAttr }),
]);

/** [택1] 발동 트리거 (구 obstacle) */
const Trigger = z.discriminatedUnion("type", [
  z.object({ type: z.literal("always") }),
  z.object({ type: z.literal("periodic"), period: Period3 }),
  z.object({ type: z.literal("proximity"), axis: z.enum(["x", "y", "radius"]), range: Range3 }),
  z.object({ type: z.literal("switch") }),
]);

export const BlockAttrs = z
  .object({
    v: z.literal(1),
    size: SizeCells,
    collision: Collision,
    shape: Shape,
    presence: Presence,
    motion: Motion,
    contactEffect: ContactEffect,
    contactReaction: ContactReaction,
    trigger: Trigger,
    // 독립 옵션
    slippery: z.boolean(),
    conveyor: z.object({ dir: z.enum(["left", "right"]), speed: Speed3 }).nullable(),
    bouncy: z.object({ power: Power2 }).nullable(),
    dash: z.boolean(),
    shooter: z
      .object({ period: Period3, speed: Speed3, aim: z.enum(["straight", "homing"]), stopNearPlayer: z.boolean() })
      .nullable(),
    harmMonsters: z.boolean(),
    breakBlocks: z.boolean(),
    togglesSwitch: z.boolean(),                        // 접촉 시 라인 스위치 토글
    // 물음표 블록(2026-07-16 추가) — 밟으면(머리치기/내려찍기) 이 종류 아이템 지급. 기존 저장물 호환 default "none".
    itemGiver: z.enum(["none", "speed", "giant"]).default("none"),
  })
  .superRefine((a, ctx) => {
    if (a.contactReaction.type !== "none" && a.motion.type !== "none") {
      ctx.addIssue({ code: "custom", message: "접촉 반응과 이동을 동시에 켤 수 없습니다" });
    }
    if (a.shape.type === "slope" && (a.motion.type !== "none" || a.contactReaction.type !== "none")) {
      ctx.addIssue({ code: "custom", message: "경사 모양은 이동·접촉 반응과 조합할 수 없습니다" });
    }
  });
export type BlockAttrs = z.infer<typeof BlockAttrs>;

export const defaultBlockAttrs = (): BlockAttrs => ({
  v: 1,
  size: { w: 1, h: 1 },
  collision: { type: "full" },
  shape: { type: "rect" },
  presence: { type: "always" },
  motion: { type: "none" },
  contactEffect: { type: "none" },
  contactReaction: { type: "none" },
  trigger: { type: "always" },
  slippery: false,
  conveyor: null,
  bouncy: null,
  dash: false,
  shooter: null,
  harmMonsters: false,
  breakBlocks: false,
  togglesSwitch: false,
  itemGiver: "none",
});

/** 충돌 방식 → 4면 플래그. none = 전부 false(비충돌) */
export function collisionFaces(c: z.infer<typeof Collision>): FacesAttr {
  switch (c.type) {
    case "full": return { top: true, bottom: true, left: true, right: true };
    case "top_only": return { top: true, bottom: false, left: false, right: false };
    case "faces": return c.faces;
    case "none": return { top: false, bottom: false, left: false, right: false };
  }
}
