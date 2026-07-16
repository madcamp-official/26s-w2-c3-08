// BaseworldScene이 소비하는 월드 형태 — TESTMAP 하드코딩 제거(2026-07-16)의 핵심 계약.
// TESTMAP 자체가 이 형태를 만족하므로 기존 콘솔 경로(baseworld 명령)는 기본값으로 그대로 동작하고,
// 테스트 모드·실전 레이스는 mergeLines(shared/build) 결과를 worldFromMerged로 변환해 주입한다.
import { TUNING } from "shared/physics";
import type { Terrain } from "shared/physics";
import type { BlockSpec, MonsterSpec, ItemSpec, LineBounds } from "shared/parts";
import { FLAGPOLE } from "shared/race";
import type { MergedMap } from "shared/build";

export interface SceneWorld {
  /** 월드 가로(px). 카메라 바운드·격자용. */
  width: number;
  /** 월드 세로(px, top부터 아래로). */
  height: number;
  /** 월드 상단 y(px) — 병합맵은 깃발 y 누적으로 위(음수)로 뻗을 수 있음. 기본 0. */
  top?: number;
  spawn: { x: number; y: number };
  line: LineBounds;
  terrain: Terrain;
  blocks: BlockSpec[];
  monsters: MonsterSpec[];
  items: ItemSpec[];
}

const T = TUNING.world.tileSize;

/** mergeLines 결과 → SceneWorld. 세로 범위는 깃발(깃대 높이 포함)~fallY에 여유를 둔다. */
export function worldFromMerged(m: MergedMap): SceneWorld {
  const flagYs = m.lineFlags.flatMap((f) => [f.start.y, f.end.y]);
  const minFlagY = flagYs.length ? Math.min(...flagYs) : 0;
  const top = Math.min(0, (minFlagY - FLAGPOLE.poleHeightTiles - 4) * T);
  const bottom = m.fallY + 4 * T;
  return {
    width: m.worldDef.line.endX,
    height: bottom - top,
    top,
    spawn: m.worldDef.spawn,
    line: m.worldDef.line,
    terrain: m.worldDef.terrain,
    blocks: m.worldDef.blocks,
    monsters: m.worldDef.monsters,
    items: m.worldDef.items,
  };
}
