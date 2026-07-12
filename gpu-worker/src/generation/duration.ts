// 액션별 생성 길이·fps — 액션 이름을 하나하나 나열하지 않는다. 앞으로 액션이 무수히 늘어날 걸
// 감안해, shared/actions/catalog.ts의 DerivedAction.loop 플래그 하나로 대다수를 커버한다:
// walk/fly/climb 등 반복 재생 동작은 Stage 5f(루프 구간 자동 선택)가 고를 사이클 후보가 넉넉해야
// 하므로 더 길게(loop 버킷), onair/attack처럼 1회성 동작은 짧게(oneShot 버킷). 새 액션을 추가해도
// derive.ts에서 loop:true/false만 정해주면 이 함수는 코드 수정 없이 자동으로 알맞은 길이를 고른다.
// 정말 예외적인 경우(예: idle은 반복이지만 walk보다 짧아도 됨)만 config의 overrides로 개별 지정.
import { pipelineConfig } from "../config/index.js";

export interface GenDuration {
  durationSec: number;
  fps: number;
}

export function resolveGenDuration(action: string, loop: boolean): GenDuration {
  const cfg = pipelineConfig.generation.duration;
  return cfg.overrides[action] ?? (loop ? cfg.loop : cfg.oneShot);
}
