// 조건→행동 시스템 타입. 몬스터·블록 Mover·발사체가 전부 이 하나로 움직인다 (§65 통합).
import type { Body } from "../physics/body.js";
import type { Terrain } from "../physics/terrain.js";
import type { Tuning } from "../physics/tuning.js";

/** 규칙 평가 시 주어지는 "지금 상황" */
export interface Ctx {
  self: Body;
  dtMs: number;
  t: Tuning;
  terrain: Terrain;
  /** 서버가 아는 플레이어들(어그로·감지용). 클라 로컬 실행 시엔 고스트 좌표 */
  players: Body[];
  /** 어그로 대상 (히스테리시스 적용된 현재 타깃) */
  target: Body | null;
  /** 서버 확정 랜덤 (§60 — 결과가 하나여야 하는 랜덤은 서버가 굴림) */
  rng: () => number;
  /** 파츠별 휘발 상태 저장 (타이머·페이즈 등) */
  mem: Record<string, number>;
  /** 자신 상태 이벤트 플래그 (이번 틱): stomped/hit/landed/actionDone */
  events: Set<string>;
  /** 발사체 생성 등 월드 부수효과 요청 */
  emit: (kind: string, data: Record<string, unknown>) => void;
  /** 스위치 상태 (자기 라인) */
  switchOn: boolean;
  /** 몬스터 체력 비율 0~1 (HP집합 기반) */
  hpRatio: number;
}

export type Condition = (ctx: Ctx) => boolean;
export type Action = (ctx: Ctx) => void;

/** JSON으로 직렬화되는 규칙 정의 (유저 제작물) */
export interface CondSpec { type: string; [k: string]: unknown }
export interface ActSpec { type: string; [k: string]: unknown }
export interface RuleSpec {
  when: CondSpec;
  do: ActSpec;
  priority?: number;
  /** 선딜 ms (지정 시 서버가 절대시각 예약, §23) */
  windupMs?: number;
}

/** 옵션이 요구하는 애니·사운드 슬롯 선언 (§64) */
export interface SlotDecl {
  anim?: Record<string, string>;   // 역할 → 슬롯명 (예: windup → "windup.slam")
  sound?: Record<string, string>;
}
