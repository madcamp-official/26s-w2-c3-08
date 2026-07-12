// 액션(애니메이션) 이름 레지스트리 — AssetSprite.action에 저장되는 표준 문자열.
// DB 컬럼이 String(enum 아님)이므로 액션 추가 = 이 파일 수정만으로 끝 (schema.prisma 설계 의도).
//
// 원칙 (2026-07-12 팀 방침): 액션 세트는 카테고리+옵션이 자동 결정 (screen-design.md 공통 컴포넌트 §).
// 거의 모든 에셋이 1개 이상의 루프 애니메이션을 가진다 — 배경 잔디도 idle(흔들림) 루프.

export const ACTION = {
  idle: "idle",       // 모든 에셋 공통 기본 루프 (정지처럼 보여도 미세 루프 영상)
  walk: "walk",       // 제자리 걷기 (아바타·보행 몬스터)
  onair: "onair",     // 점프/체공 (아바타)
  fly: "fly",         // 부유/비행 루프 (비행 몬스터)
  climb: "climb",     // 표면 타기 루프 (등반 몬스터)
  attack: "attack",   // 발사/공격 모션 (발사체 발사 몬스터)
} as const;
export type ActionName = (typeof ACTION)[keyof typeof ACTION];

/**
 * 액션별 기본 모션 힌트(영어) — 영상 프롬프트의 "모션" 부분.
 * 최종 프롬프트 조립(파이프라인): [외형 묘사(wan_prompt 또는 스텁)] + [모션 힌트] + [고정 안정화 지시부] + [크로마키 배경 지시].
 * 고정 안정화 지시부는 ai-pipeline.md §2: single character, plain background, side view, full body,
 * static camera, no forward movement, seamless loop.
 */
export const MOTION_HINT: Record<ActionName, string> = {
  idle: "standing still, subtle breathing motion, gentle natural sway, minimal movement",
  walk: "walking in place, steady natural gait, arms swinging",
  onair: "jumping pose held in mid-air, limbs slightly spread, floating in place",
  fly: "hovering in place, gentle bobbing up and down, wings or body flutter",
  climb: "clinging to a vertical surface, slow crawling motion in place",
  attack: "quickly performs a throwing or shooting motion, small recoil, returns exactly to the starting pose",
};
