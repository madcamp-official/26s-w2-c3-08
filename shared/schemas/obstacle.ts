// 장애물 attrs — asset-attributes.md §2.
// 발사체 이미지는 attrs가 아니라 Asset.projectileImageUrl 컬럼 (md §2 방침: AI 생성 없음, 1×1 이하 정지 이미지 + 코드 회전).
// 압사(끼임) 규칙은 에셋 속성이 아니라 엔진 전역 규칙 (md §2 주석).
import { z } from "zod";
import { Period3, Power2, Range3, SizeCells, Speed3 } from "./presets.js";

/** 접촉 판정 부위 — 접촉 효과가 대미지/즉사일 때만 의미 (md §2) */
const HitZone = z.enum(["all", "except_top", "bottom_only"]); // 전체 / 상면 제외(밟기 가능) / 하면만(고드름)

/** [택1] 접촉 효과 — 즉사 제거(2026-07-14): HP 1/2 모델이라 모든 대미지가 사실상 치명, 별도 즉사 불필요 */
const ContactEffect = z.discriminatedUnion("type", [
  z.object({ type: z.literal("damage"), zone: HitZone }),       // 대미지 (HP -1 = 소형이면 사망)
  z.object({ type: z.literal("knockback"), power: Power2 }),    // 튕겨냄 — 무해 (범퍼)
  z.object({ type: z.literal("updraft") }),                     // 상승 기류 — 무해 (회오리)
]);

/** [택1] 발동 트리거 */
const Trigger = z.discriminatedUnion("type", [
  z.object({ type: z.literal("always") }),                                          // 상시 활성
  z.object({ type: z.literal("periodic"), period: Period3 }),                       // 주기 돌출/후퇴
  z.object({ type: z.literal("proximity"), axis: z.enum(["x", "y", "radius"]), range: Range3 }), // 접근 감지
  z.object({ type: z.literal("switch") }),                                          // 스위치 연동
]);

/** [택1] 이동·동작 방식 — 스프라이트 자체는 idle 루프, 회전·이동은 코드가 수행 */
const Motion = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),                                            // 고정
  z.object({ type: z.literal("spin"), speed: Speed3, radius: Range3 }),             // 제자리 회전 (파이어바)
  z.object({ type: z.literal("pendulum") }),                                        // 진자 스윙 (클로)
  z.object({ type: z.literal("patrol"), speed: Speed3 }),                           // 경로 왕복
  z.object({
    type: z.literal("charge"),                                                      // 감지 시 돌진 (쿵쿵·고드름)
    dir: z.enum(["down", "left", "right"]),
    after: z.enum(["return", "respawn", "once"]),                                   // 복귀 / 재생성 / 일회성
  }),
]);

export const ObstacleAttrs = z.object({
  v: z.literal(1),
  size: SizeCells,
  contactEffect: ContactEffect,
  trigger: Trigger,
  motion: Motion,
  // 독립 옵션 (md §2)
  shooter: z
    .object({
      period: Period3,
      speed: Speed3,                                  // 탄속
      aim: z.enum(["straight", "homing"]),            // 직선 / 유도
      stopNearPlayer: z.boolean(),                    // 플레이어 인접 시 발사 정지 (킬러 대포)
    })
    .nullable(),
  harmMonsters: z.boolean(),                          // 몬스터에게도 피해
  breakBlocks: z.boolean(),                           // 블록 파괴 능력 (스큐어)
  // 접촉 시 라인 스위치 토글 ("스위치 역할" 옵션). 런타임은 switchToggle 물성으로 연결 —
  // attrs→파츠 빌더가 이 플래그를 보고 properties에 { type:"switchToggle" }를 넣어야 함(빌더 미구현).
  // 라인당 전역 스위치·OFF 시작·서버 권위. 디바운스는 나중 일괄(클라즉시+서버쿨다운). visual-language.md 참조.
  togglesSwitch: z.boolean(),
});
export type ObstacleAttrs = z.infer<typeof ObstacleAttrs>;

export const defaultObstacleAttrs = (): ObstacleAttrs => ({
  v: 1,
  size: { w: 1, h: 1 },
  contactEffect: { type: "damage", zone: "all" },
  trigger: { type: "always" },
  motion: { type: "none" },
  shooter: null,
  harmMonsters: false,
  breakBlocks: false,
  togglesSwitch: false,
});
