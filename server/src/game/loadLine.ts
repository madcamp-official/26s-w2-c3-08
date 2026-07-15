// MapLine(+placements, DB) → BlockSpec[]/MonsterSpec[]. buildBlock/buildMonster(shared/build)가
// attrs→런타임 파츠 변환을 담당 — 여기는 타일→px 변환 + 카테고리 라우팅만.
import type { Prisma } from "@prisma/client";
import { TUNING } from "shared/physics";
import { parseAttrs, type Category, type BlockAttrs, type MonsterAttrs } from "shared/schemas";
import { buildBlock, buildMonster, type BuildGeom } from "shared/build";
import type { BlockSpec } from "shared/parts";
import type { MonsterSpec } from "shared/parts";

const T = TUNING.world.tileSize;

export type LineWithPlacements = Prisma.MapLineGetPayload<{
  include: { placements: { include: { asset: true } } };
}>;

export interface LoadedLine {
  tileLength: number;
  startFlag: { x: number; y: number };
  endFlag: { x: number; y: number };
  blocks: BlockSpec[];
  monsters: MonsterSpec[];
}

/**
 * 라인 1개를 런타임 파츠로 변환. offsetXTiles/offsetYTiles(타일)는 병합 시 mergeLines가 넘긴다.
 * avatar/item/background 배치는 스킵 — 블록·몬스터만 라인에 실체화한다(item은 emitsItem 경로로 이미 커버).
 */
export function loadLine(line: LineWithPlacements, offsetXTiles = 0, offsetYTiles = 0): LoadedLine {
  const blocks: BlockSpec[] = [];
  const monsters: MonsterSpec[] = [];

  for (const p of line.placements) {
    const category = p.asset.category as Category;
    if (category !== "block" && category !== "monster") continue;

    const geomOf = (size: { w: number; h: number }): BuildGeom => ({
      x: (p.x + offsetXTiles) * T, y: (p.y + offsetYTiles) * T,
      w: size.w * T, h: size.h * T,
      flipX: p.flipX,
      endX: p.endX != null ? (p.endX + offsetXTiles) * T : undefined,
      endY: p.endY != null ? (p.endY + offsetYTiles) * T : undefined,
    });
    const id = `p${p.id}`;

    try {
      if (category === "block") {
        const attrs: BlockAttrs = parseAttrs("block", p.asset.attrs);
        blocks.push(buildBlock(id, attrs, geomOf(attrs.size)));
      } else {
        const attrs: MonsterAttrs = parseAttrs("monster", p.asset.attrs);
        monsters.push(buildMonster(id, p.asset.name, attrs, geomOf(attrs.size)));
      }
    } catch (e) {
      console.warn(`[loadLine] placement ${p.id} attrs 검증 실패, 스킵:`, e instanceof Error ? e.message : e);
    }
  }

  return {
    tileLength: line.tileLength,
    startFlag: { x: line.startFlagX + offsetXTiles, y: line.startFlagY + offsetYTiles },
    endFlag: { x: line.endFlagX + offsetXTiles, y: line.endFlagY + offsetYTiles },
    blocks, monsters,
  };
}
