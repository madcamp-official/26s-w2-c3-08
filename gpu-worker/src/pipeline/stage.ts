// Stage 인터페이스 + 실패 신호.
// 확장 원칙: 모든 후처리 단계는 Stage 하나로 표현된다. 순서·구성은 Pipeline 생성 시 배열로 주입 —
// 코드가 아니라 조립으로 파이프라인 모양을 바꾼다(재배치·삽입·제거 자유).
import type { PipelineContext } from "./types.js";

export interface Stage {
  /** 로그·에러 식별용 고유 이름 (kebab-case 권장) */
  readonly name: string;
  /**
   * ctx.frames 등을 제자리 변형. 되돌릴 수 없는 실패는 StageFailure를 throw.
   * (예: 크로마키 신뢰도 미달 → 이 액션 생성 자체를 failed 처리)
   */
  run(ctx: PipelineContext): Promise<void> | void;
}

/** 재시도해도 소용없는 생성물 자체의 실패 — 러너가 잡아 파이프라인을 중단하고 상위(재생성 큐)로 올린다. */
export class StageFailure extends Error {
  constructor(
    readonly stage: string,
    readonly reason: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(`[${stage}] ${reason}`);
    this.name = "StageFailure";
  }
}
