// 플랫폼 attrs — asset-attributes.md §1. [택1] 그룹 = discriminatedUnion, 독립 옵션 = boolean 또는 nullable 파라미터 객체.
import { z } from "zod";
import { Faces, Period3, Power2, SizeCells, Speed3 } from "./presets.js";

/** [택1] 충돌 방식 — 내부 구현은 셋 다 4면 플래그로 통일 (md §1 주석). collisionFaces() 참조 */
const Collision = z.discriminatedUnion("type", [
  z.object({ type: z.literal("full") }),                    // 완전 충돌 (기본)
  z.object({ type: z.literal("top_only") }),                // 윗면만 = 반통과
  z.object({ type: z.literal("faces"), faces: Faces }),     // 특정 면만 = 일방통행
]);

/** [택1] 실체화 조건 */
const Presence = z.discriminatedUnion("type", [
  z.object({ type: z.literal("always") }),                  // 항상 실체 (기본)
  z.object({ type: z.literal("hidden") }),                  // 숨겨짐 — 아래서 치면 실체화
  z.object({ type: z.literal("switch_on") }),               // 스위치 ON일 때 실체
  z.object({ type: z.literal("switch_off") }),              // 스위치 OFF일 때 실체
  z.object({ type: z.literal("blink"), period: Period3 }),  // 주기 점멸
]);

/** [택1] 이동 방식 */
const Movement = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),                                  // 고정 (기본)
  z.object({ type: z.literal("patrol"), speed: Speed3 }),                 // 경로 왕복
  z.object({ type: z.literal("ride_start") }),                            // 밟으면 경로 이동 시작
  z.object({ type: z.literal("ride_oneway"), sink: z.boolean() }),        // 밟으면 한 방향 (+침몰 T/F)
]);

/** [택1] 모양 — slopeDir 문자열은 DB 컬럼(schema.prisma Asset.slopeDir 주석)과 동일 표기 */
const Shape = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rect") }),                    // 사각형 (기본)
  z.object({
    type: z.literal("slope"),
    dir: z.enum(["floor-asc", "floor-desc", "ceil-desc", "ceil-asc"]), // ◢ ◣ ◥ ◤ (천장 2종은 2차)
  }),
]);

/** [택1] 접촉 반응 — 시간은 고정 상수(shared/constants.ts CONTACT_REACTION), 재생은 항상(옵션 아님, md §1) */
const ContactReaction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),                                        // 없음 (기본)
  z.object({ type: z.literal("fall"), senseFaces: Faces }),                     // n초 후 낙하 → 재생
  z.object({ type: z.literal("break"), senseFaces: Faces }),                    // n초 후 파괴 → 재생
]);

export const PlatformAttrs = z
  .object({
    v: z.literal(1),                       // attrs 스키마 버전 (형태 변경 시 마이그레이션 근거)
    size: SizeCells,
    collision: Collision,
    presence: Presence,
    movement: Movement,
    shape: Shape,
    contactReaction: ContactReaction,
    // 독립 옵션 (md §1)
    slippery: z.boolean(),                                                     // 표면 미끄러움
    conveyor: z.object({ dir: z.enum(["left", "right"]), speed: Speed3 }).nullable(), // 탑승자 밀어냄
    bouncy: z.object({ power: Power2 }).nullable(),                            // 밟으면 튕김
    dash: z.boolean(),                                                         // 밟으면 가속
    tilt: z.boolean(),                                                         // 시소 — 확장용 예약(물리 비용 큼), UI 미노출
  })
  .superRefine((a, ctx) => {
    // md §1 ⚠️: "접촉 반응 ≠ 없음"과 "이동 ≠ 고정" 동시 선택 금지 (동기화 단순화)
    if (a.contactReaction.type !== "none" && a.movement.type !== "none") {
      ctx.addIssue({ code: "custom", message: "접촉 반응과 이동을 동시에 켤 수 없습니다" });
    }
    // md §1 모양 주석: 경사 + 이동/접촉반응 조합 금지
    if (a.shape.type === "slope" && (a.movement.type !== "none" || a.contactReaction.type !== "none")) {
      ctx.addIssue({ code: "custom", message: "경사 모양은 이동·접촉 반응과 조합할 수 없습니다" });
    }
  });
export type PlatformAttrs = z.infer<typeof PlatformAttrs>;

export const defaultPlatformAttrs = (): PlatformAttrs => ({
  v: 1,
  size: { w: 1, h: 1 },
  collision: { type: "full" },
  presence: { type: "always" },
  movement: { type: "none" },
  shape: { type: "rect" },
  contactReaction: { type: "none" },
  slippery: false,
  conveyor: null,
  bouncy: null,
  dash: false,
  tilt: false,
});

/** 충돌 방식 → 4면 플래그 통일 (md §1: Phaser checkCollision.up/down/left/right와 1:1) */
export function collisionFaces(c: z.infer<typeof Collision>): Faces {
  switch (c.type) {
    case "full": return { up: true, down: true, left: true, right: true };
    case "top_only": return { up: true, down: false, left: false, right: false };
    case "faces": return c.faces;
  }
}
