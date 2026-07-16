// 라인 레코드(DB 행 또는 API JSON) → BlockSpec[]/MonsterSpec[]. buildBlock/buildMonster가
// attrs→런타임 파츠 변환을 담당 — 여기는 타일→px 변환 + 카테고리 라우팅만.
// 서버(server/src/game)에서 shared로 이동: 클라 테스트 하네스가 같은 함수로 지형을 조립해야
// 정확한 리스폰·골 판정이 성립하기 때문. Prisma 타입 의존 제거(구조적 호환 인터페이스).
import { TUNING } from "../physics/tuning.js";
import { parseAttrs, type Category, type BlockAttrs, type MonsterAttrs, type ItemAttrs } from "../schemas/index.js";
import { buildBlock, buildMonster, type BuildGeom } from "./buildRuntimePart.js";
import type { BlockSpec } from "../parts/block.js";
import type { MonsterSpec } from "../parts/monster.js";
import type { ItemSpec, ItemKind } from "../parts/item.js";

/** ItemAttrs.effect → 런타임 ItemKind (거대버섯=생명+크기 동시 적용 전용 kind) */
const EFFECT_TO_KIND: Record<ItemAttrs["effect"], ItemKind> = {
  giant_mushroom: "giant",
  speed_boost: "speed",
};

const T = TUNING.world.tileSize;

/** MapLinePlacement 행/JSON과 구조 호환 (id는 BigInt·string·number 어느 쪽이든) */
export interface LinePlacementRecord {
  id: string | number | bigint;
  x: number;
  y: number;
  flipX: boolean;
  endX: number | null;
  endY: number | null;
  asset: { name: string; category: string; attrs: unknown };
}

/** MapLine 행/JSON과 구조 호환 */
export interface LineRecord {
  tileLength: number;
  startFlagX: number;
  startFlagY: number;
  endFlagX: number;
  endFlagY: number;
  placements: LinePlacementRecord[];
}

export interface LoadedLine {
  tileLength: number;
  startFlag: { x: number; y: number };
  endFlag: { x: number; y: number };
  blocks: BlockSpec[];
  monsters: MonsterSpec[];
  items: ItemSpec[];
  /** 배치물·깃발 기단을 포함한 세로 최하단(타일) — 추락사 경계 계산용 */
  contentMaxYTiles: number;
}

/**
 * 라인 1개를 런타임 파츠로 변환. offsetXTiles/offsetYTiles(타일)는 병합 시 mergeLines가 넘긴다.
 * avatar/background 배치는 스킵 — 블록·몬스터·아이템(2026-07-16 추가)을 라인에 실체화한다.
 */
export function loadLine(line: LineRecord, offsetXTiles = 0, offsetYTiles = 0): LoadedLine {
  const blocks: BlockSpec[] = [];
  const monsters: MonsterSpec[] = [];
  const items: ItemSpec[] = [];
  let contentMaxY = Math.max(line.startFlagY, line.endFlagY) + 1;   // 깃발 기단 행

  for (const p of line.placements) {
    const category = p.asset.category as Category;

    // 아이템: attrs.effect → kind. 좌표는 바닥-중앙(px) 관례(ItemSpec.x=중앙, y=바닥).
    if (category === "item") {
      try {
        const attrs: ItemAttrs = parseAttrs("item", p.asset.attrs);
        items.push({
          id: `p${p.id}`,
          kind: EFFECT_TO_KIND[attrs.effect],
          x: (p.x + offsetXTiles) * T + T / 2,
          y: (p.y + offsetYTiles + 1) * T,
          asset: p.asset.name,
        });
        contentMaxY = Math.max(contentMaxY, p.y + 1);
      } catch (e) {
        console.warn(`[loadLine] item placement ${p.id} attrs 검증 실패, 스킵:`, e instanceof Error ? e.message : e);
      }
      continue;
    }
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
        contentMaxY = Math.max(contentMaxY, p.y + attrs.size.h);
      } else {
        const attrs: MonsterAttrs = parseAttrs("monster", p.asset.attrs);
        monsters.push(buildMonster(id, p.asset.name, attrs, geomOf(attrs.size)));
        contentMaxY = Math.max(contentMaxY, p.y + attrs.size.h);
      }
    } catch (e) {
      console.warn(`[loadLine] placement ${p.id} attrs 검증 실패, 스킵:`, e instanceof Error ? e.message : e);
    }
  }

  return {
    tileLength: line.tileLength,
    startFlag: { x: line.startFlagX + offsetXTiles, y: line.startFlagY + offsetYTiles },
    endFlag: { x: line.endFlagX + offsetXTiles, y: line.endFlagY + offsetYTiles },
    blocks, monsters, items,
    contentMaxYTiles: contentMaxY + offsetYTiles,
  };
}
