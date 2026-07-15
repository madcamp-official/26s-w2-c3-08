// 액션(애니메이션) 카탈로그 — AssetSprite.action에 저장되는 표준 문자열 + 액션별 생성 요구.
// DB 컬럼이 String(enum 아님)이므로 액션 추가 = 이 파일 수정만으로 끝 (schema.prisma 설계 의도).
//
// 원칙 (2026-07-12 팀 방침): 액션 세트는 카테고리+옵션이 자동 결정 (deriveActions).
// 거의 모든 에셋이 1개 이상의 루프 애니메이션을 가진다 — 배경 잔디도 idle(흔들림) 루프.
// 윈드업·피격·죽음·회전·돌진·웅크리기·슬라이드·내려찍기 등은 생성 대상 아님 — 코드가 스프라이트를 움직여 표현.

export const ACTION = {
  idle: "idle",       // 모든 에셋 공통 기본 루프 (정지처럼 보여도 미세 루프 영상)
  walk: "walk",       // 제자리 걷기 (아바타·보행 몬스터)
  onair: "onair",     // 점프/체공 (아바타) — 1회성 held 포즈
  fly: "fly",         // 부유/비행 루프 (비행 몬스터)
  climb: "climb",     // 표면 타기 루프 (등반 몬스터)
  attack: "attack",   // 발사/공격 모션 (발사체 발사 몬스터) — 1회성, 시작 포즈 복귀
} as const;
export type ActionName = (typeof ACTION)[keyof typeof ACTION];

/**
 * 액션 하나가 자기 생성 요구를 전부 들고 있는 스펙 (§ActionSpec).
 * 이 파일이 "액션별 상세 요구"의 단일 소스 — 프롬프트 조립·길이 결정이 여기만 읽으면 됨.
 *
 * 최종 프롬프트(백엔드/파이프라인): [외형(wan_prompt)] + [motionHint] + [poseHint] + [공통 안정화 지시부] + [크로마키 배경].
 * 공통 안정화 지시부(ai-pipeline.md §2): single character, plain solid background, side view, full body,
 * static camera, no forward movement, seamless loop.  ← 액션 무관 전역. 액션별 차이는 아래 필드로.
 */
export interface ActionSpec {
  /**
   * 프롬프트의 "모션" 부분 중 사지 유무와 무관하게 항상 참인 서술(영어).
   * deriveActions가 attrs로 override 가능(예: fast → briskly, 이 경우 motionHintArms/Legs는 무시됨).
   */
  motionHintCore: string;
  /** motionHintCore에 얹는 팔 동작 서술 — gpu-worker가 원본에 팔이 없다고 판단하면 뺀다(anatomy 판단). */
  motionHintArms?: string;
  /** motionHintCore에 얹는 다리 동작 서술 — 다리 없다고 판단하면 뺀다. */
  motionHintLegs?: string;
  /** 반복 재생(loop 버킷) vs 1회성(oneShot 버킷) — 생성 길이·루프 처리 분기. */
  loop: boolean;
  /** 1회성이 시작 포즈로 정확히 복귀해야 하나 (이음새·재생 안정). loop면 무의미. */
  returnsToStart: boolean;
  /** 예외 길이(초). 생략 시 loop/oneShot 버킷 자동 (loop=3s, oneShot=1.5s — config). */
  durationSec?: number;
  /** 이 액션만의 자세/카메라 상세 (프롬프트 보강). 전역 안정화 지시부에 얹힘. */
  poseHint?: string;
  /** 이 액션만의 추가 금지 (네거티브 프롬프트 보강). */
  negativeExtra?: string[];
}

/** motionHintCore + Arms + Legs를 하나의 문자열로 합친다 — 사지 판단 전(서버 측) 기본 완전판. */
export function fullMotionHint(spec: Pick<ActionSpec, "motionHintCore" | "motionHintArms" | "motionHintLegs">): string {
  return [spec.motionHintCore, spec.motionHintArms, spec.motionHintLegs].filter(Boolean).join(", ");
}

export const ACTIONS: Record<ActionName, ActionSpec> = {
  idle: {
    motionHintCore: "standing still, subtle breathing motion, gentle natural sway, minimal movement",
    loop: true,
    returnsToStart: false,
    durationSec: 2,
    poseHint: "neutral resting stance, weight centered",
  },
  walk: {
    motionHintCore: "walking in place, steady natural gait",
    motionHintArms: "arms swinging",
    loop: true,
    returnsToStart: false,
    poseHint: "in-place walk cycle, feet return to the same spot each loop",
  },
  onair: {
    // 1회성 held 포즈 (루프 아님) — 이전 버그: loop:true 하드코딩으로 loop 버킷(3s) 탔음
    motionHintCore: "jumping pose held in mid-air, floating in place",
    motionHintArms: "arms spread",
    motionHintLegs: "legs spread",
    loop: false,
    returnsToStart: false,
    poseHint: "single held mid-air pose, no walk cycle, feet off the ground",
    negativeExtra: ["walking", "ground contact", "running"],
  },
  fly: {
    motionHintCore: "hovering in place, gentle bobbing up and down, wings or body flutter",
    loop: true,
    returnsToStart: false,
    poseHint: "hover bob, stays in one spot",
  },
  climb: {
    motionHintCore: "clinging to a vertical surface, slow crawling motion in place",
    loop: true,
    returnsToStart: false,
  },
  attack: {
    // 1회성 — 시작 포즈로 정확 복귀
    motionHintCore: "quickly performs an attack motion, small recoil, returns exactly to the starting pose",
    motionHintArms: "throwing or shooting motion with an arm",
    loop: false,
    returnsToStart: true,
    poseHint: "brief windup, strike, then exact return to the idle pose",
    negativeExtra: ["repeating loop", "continuous motion"],
  },
};
