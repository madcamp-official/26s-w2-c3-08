// 모션 토큰 — 모든 패널이 "자기 붙어있는 화면 가장자리"에서 스프링으로 날아들어온다(2026-07-14 지시).
// 닫을 때는 역방향(같은 hidden 좌표로 되돌아가며 퇴장) — 별도 exit 변형 불필요, hidden 재사용.
import type { Transition, Variants } from "framer-motion";

export const springPop: Transition = { type: "spring", stiffness: 500, damping: 28 };
export const staggerStepSec = 0.05;

/** 닫기 연출이 대략 정착하는 시간(ms) — 이후 실제 언마운트 */
export const CLOSE_SETTLE_MS = 480;

const OFFSET = 560;

export const fromLeft: Variants = { hidden: { x: -OFFSET, opacity: 0 }, visible: { x: 0, opacity: 1 } };
export const fromRight: Variants = { hidden: { x: OFFSET, opacity: 0 }, visible: { x: 0, opacity: 1 } };
export const fromTop: Variants = { hidden: { y: -OFFSET, opacity: 0 }, visible: { y: 0, opacity: 1 } };
export const fromBottom: Variants = { hidden: { y: OFFSET, opacity: 0 }, visible: { y: 0, opacity: 1 } };
export const fromCenter: Variants = { hidden: { scale: 0.85, opacity: 0 }, visible: { scale: 1, opacity: 1 } };

/** 진입 시 index만큼 스태거 지연, 퇴장 시 지연 없이 동시에 물러남 */
export function edgeTransition(index: number, closing: boolean): Transition {
  return { ...springPop, delay: closing ? 0 : index * staggerStepSec };
}
