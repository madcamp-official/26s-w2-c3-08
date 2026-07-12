// 물성 레지스트리: "닿은/올라선 상대(주로 플레이어)에게 무엇을 하나".
// 적용 주체 = 당하는 클라 로컬 (§14). 물성 1개 = 파일 1개 + 등록 한 줄 (§56).
import type { Body } from "../physics/body.js";
import type { Tuning } from "../physics/tuning.js";
import type { SlotDecl } from "../behavior/types.js";

export type TouchSide = "top" | "bottom" | "left" | "right";

export interface PropertyImpl {
  /** 상대가 나(블록)와 접촉 중일 때 매 틱 (side = 상대 기준 접촉면) */
  onTouch?: (other: Body, selfRect: { x: number; y: number; w: number; h: number }, side: TouchSide, t: Tuning, params: Record<string, unknown>) => void;
  /** 위에 서 있을 때 매 틱 */
  onStand?: (other: Body, t: Tuning, params: Record<string, unknown>) => void;
  /** 마찰 계수 오버라이드 (감속 배율 0~1, 미끄러움) */
  frictionMult?: number;
  slots?: SlotDecl;
}

const props = new Map<string, PropertyImpl>();
export function registerProperty(name: string, impl: PropertyImpl): void { props.set(name, impl); }
export function getProperty(name: string): PropertyImpl | undefined { return props.get(name); }
export function listProperties(): string[] { return [...props.keys()]; }
