// 몬스터 attrs — asset-attributes.md §3. 마리오 패턴을 옵션 조합으로 표현(2026-07-14 확장).
import { z } from "zod";
import { Hp3, Period3, Power2, Range3, SizeCells, Speed3 } from "./presets.js";

/** [택1] 이동 유형 — 절벽 반응은 지상 보행일 때만 */
const Locomotion = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stationary") }),
  z.object({ type: z.literal("walk"), speed: Speed3, cliff: z.enum(["fall", "turn"]) }),
  z.object({ type: z.literal("climb") }),
  z.object({ type: z.literal("fly") }),
]);

/** [택1] 추적 방식 (+ flee 도망) */
const Pursuit = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("proximity"), range: Range3 }),
  z.object({ type: z.literal("always") }),
  z.object({ type: z.literal("sight") }),        // 부끄부끄
  z.object({ type: z.literal("jump_sync") }),
  z.object({ type: z.literal("flee"), range: Range3 }),  // 보면 도망
]);

/** [택1] 밟기 반응 (+ shell 등껍질 / explode 폭발) */
const StompReaction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("die") }),
  z.object({ type: z.literal("stun"), respawn: Period3 }),
  z.object({ type: z.literal("spiky") }),
  z.object({ type: z.literal("trampoline") }),
  z.object({ type: z.literal("shell") }),        // 엉금엉금 — 껍질로 변해 차서 굴리기
  z.object({ type: z.literal("explode"), radius: Range3 }),  // 폭탄병 — 밟으면 폭발
]);

export const MonsterAttrs = z
  .object({
    v: z.literal(1),
    size: SizeCells,
    locomotion: Locomotion,
    pursuit: Pursuit,
    stompReaction: StompReaction,
    hp: Hp3,
    contactDamage: z.boolean(),
    // 발사 — trigger로 발동 조건 게이팅(주기/근접/시야)
    shooter: z
      .object({
        trigger: z.enum(["periodic", "proximity", "sight"]),
        period: Period3,
        arc: z.enum(["straight", "arc", "homing"]),
        range: Range3,                            // proximity일 때 감지 거리
      })
      .nullable(),
    hop: z.object({ height: Power2 }).nullable(),                 // 주기 도약
    // 잠복→등장 (뻐끔플라워·두더지): 숨어 있다가 트리거로 나옴
    emerge: z.object({ trigger: z.enum(["periodic", "proximity"]), period: Period3, range: Range3 }).nullable(),
    // 순간이동 (마귀쿠파)
    teleport: z.object({ trigger: z.enum(["periodic", "on_hit"]), period: Period3 }).nullable(),
    anchor: z.boolean(),                          // 돌진 후 원위치 복귀 (사슬·와글와글)
    enrage: z.boolean(),                          // 밟으면 분노 — 가속+추적
    splitOnDeath: z.boolean(),                    // 사망 시 분열 2마리
    immortal: z.boolean(),                        // 처치 불가
    shove: z.boolean(),                           // 피해 대신 넉백
  })
  .superRefine((a, ctx) => {
    if (a.immortal && (a.hp !== 1 || a.stompReaction.type !== "spiky")) {
      ctx.addIssue({ code: "custom", message: "불사 몬스터는 생명력(1)·밟기 반응(가시)을 설정할 수 없습니다" });
    }
  });
export type MonsterAttrs = z.infer<typeof MonsterAttrs>;

export const defaultMonsterAttrs = (): MonsterAttrs => ({
  v: 1,
  size: { w: 1, h: 1 },
  locomotion: { type: "walk", speed: "normal", cliff: "fall" }, // 굼바
  pursuit: { type: "none" },
  stompReaction: { type: "die" },
  hp: 1,
  contactDamage: true,
  shooter: null,
  hop: null,
  emerge: null,
  teleport: null,
  anchor: false,
  enrage: false,
  splitOnDeath: false,
  immortal: false,
  shove: false,
});
