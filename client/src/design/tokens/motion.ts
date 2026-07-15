// 모션 토큰 — UI 모션·마이크로인터랙션 가이드(screen-design.md) 확정값.
// mapeditor/motionTokens.ts와 값은 같으나 별도 정의 — 그 파일은 다른 세션이 실시간 수정 중이라
// 통합(재수출)하지 않고 이 시스템만의 독립 사본을 둔다(단기 중복 감수, 파일 충돌 회피).
import type { Transition } from "framer-motion";

export const SPRING_POP: Transition = { type: "spring", stiffness: 500, damping: 28 };
export const EASE_ENTER = [0.22, 1, 0.36, 1] as const;
export const STAGGER_MS = 0.045;
export const HOVER_SCALE = 1.03;
export const CLICK_SCALE = 0.94;
/** 커튼이 최소 이 시간(ms)은 덮여 있어야 함 — 로딩 텍스트가 깜빡였다 사라지는 것 방지 */
export const CURTAIN_MIN_DWELL_MS = 500;
