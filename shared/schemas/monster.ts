// 몬스터 attrs — asset-attributes.md §3. 수중 유영 없음(물 미도입 확정).
import { z } from "zod";
import { Hp3, Period3, Power2, Range3, SizeCells, Speed3 } from "./presets.js";

/** [택1] 이동 유형 — 절벽 반응은 지상 보행일 때만 유효하므로 walk 안에 중첩 (md §3) */
const Locomotion = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stationary") }),                                  // 고정 (뻐끔)
  z.object({ type: z.literal("walk"), speed: Speed3, cliff: z.enum(["fall", "turn"]) }), // 지상 보행 + 절벽 반응
  z.object({ type: z.literal("climb") }),                                       // 벽·천장 표면 타기
  z.object({ type: z.literal("fly") }),                                         // 공중 부유/비행
]);

/** [택1] 추적 방식 — 시선 반응은 멀티에서 "한 명이라도 보면 정지" 규칙 (md §3) */
const Pursuit = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),                                        // 추적 안 함 (직진/왕복)
  z.object({ type: z.literal("proximity"), range: Range3 }),                    // 감지 거리 내 활성화
  z.object({ type: z.literal("always") }),                                      // 상시 추적
  z.object({ type: z.literal("sight") }),                                       // 시선 반응 (부끄부끄)
  z.object({ type: z.literal("jump_sync") }),                                   // 플레이어 점프 동기화
]);

/** [택1] 밟기 반응 — 기절 부활 시간은 프리셋 주기 재사용 */
const StompReaction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("die") }),                                         // 즉사 (굼바)
  z.object({ type: z.literal("stun"), respawn: Period3 }),                      // 기절 후 n초 뒤 부활
  z.object({ type: z.literal("spiky") }),                                       // 밟기 불가 — 밟은 쪽 피해
  z.object({ type: z.literal("trampoline") }),                                  // 밟으면 높이 튕김
]);

export const MonsterAttrs = z
  .object({
    v: z.literal(1),
    size: SizeCells,
    locomotion: Locomotion,
    pursuit: Pursuit,
    stompReaction: StompReaction,
    // 독립 옵션 (md §3)
    hp: Hp3,
    contactDamage: z.boolean(),                                                 // 기본 T
    shooter: z
      .object({ period: Period3, arc: z.enum(["straight", "arc", "homing"]) })  // 직선/포물선/유도
      .nullable(),
    hop: z.object({ height: Power2 }).nullable(),                               // 주기 도약
    enrage: z.boolean(),                                                        // 밟으면 분노 — 가속+추적 전환 (꿈틀이)
    splitOnDeath: z.boolean(),                                                  // 사망 시 분열 2마리 (거대 굼바)
    immortal: z.boolean(),                                                      // 처치 불가 — 켜면 hp·밟기 그룹 비활성 (md §3)
    shove: z.boolean(),                                                         // 밀쳐냄 — 피해 대신 넉백 (불리)
  })
  .superRefine((a, ctx) => {
    // md §3: 불사를 켜면 생명력·밟기 반응 그룹 비활성화 — 기본값 외 설정은 거부해 데이터 오염 방지
    if (a.immortal && (a.hp !== 1 || a.stompReaction.type !== "spiky")) {
      ctx.addIssue({
        code: "custom",
        message: "불사 몬스터는 생명력(1 고정)·밟기 반응(밟기 불가 고정)을 설정할 수 없습니다",
      });
    }
  });
export type MonsterAttrs = z.infer<typeof MonsterAttrs>;

export const defaultMonsterAttrs = (): MonsterAttrs => ({
  v: 1,
  size: { w: 1, h: 1 },
  locomotion: { type: "walk", speed: "normal", cliff: "fall" }, // 대표 기본형 = 굼바 (조정 가능)
  pursuit: { type: "none" },
  stompReaction: { type: "die" },
  hp: 1,
  contactDamage: true,
  shooter: null,
  hop: null,
  enrage: false,
  splitOnDeath: false,
  immortal: false,
  shove: false,
});
