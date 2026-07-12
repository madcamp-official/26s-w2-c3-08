// Pipeline 러너 — 주입된 stage 목록을 순서대로 실행하고, 단계별 시간 측정 + 실패 격리.
// 확장 원칙: 이 러너는 어떤 stage가 있는지 전혀 모른다. stage를 늘려도 러너는 불변.
import { StageFailure, type Stage } from "./stage.js";
import type { PipelineContext } from "./types.js";

export interface StageTiming {
  stage: string;
  ms: number;
}

export type PipelineResult =
  | { ok: true; timings: StageTiming[] }
  | { ok: false; failedStage: string; reason: string; detail?: Record<string, unknown>; timings: StageTiming[] };

export class Pipeline {
  constructor(private readonly stages: Stage[]) {}

  /** 실행 전 구성 확인용 (로깅·테스트) */
  get stageNames(): string[] {
    return this.stages.map((s) => s.name);
  }

  async run(ctx: PipelineContext): Promise<PipelineResult> {
    const timings: StageTiming[] = [];

    for (const stage of this.stages) {
      const t0 = performance.now();
      try {
        await stage.run(ctx);
      } catch (err) {
        const ms = performance.now() - t0;
        timings.push({ stage: stage.name, ms });
        if (err instanceof StageFailure) {
          ctx.log.warn(`stage failed (deterministic): ${err.message}`, err.detail);
          return { ok: false, failedStage: err.stage, reason: err.reason, detail: err.detail, timings };
        }
        // 예상 못 한 예외 — 버그일 가능성. stage 이름을 붙여 상위로.
        const reason = err instanceof Error ? err.message : String(err);
        ctx.log.warn(`stage threw unexpectedly: ${stage.name}: ${reason}`);
        return { ok: false, failedStage: stage.name, reason, timings };
      }
      const ms = performance.now() - t0;
      timings.push({ stage: stage.name, ms });
      ctx.log.info(`stage done: ${stage.name}`, { ms: Math.round(ms) });
    }

    return { ok: true, timings };
  }
}
