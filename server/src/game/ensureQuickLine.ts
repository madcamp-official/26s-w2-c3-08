// 간이 레이스(콘솔 startstart) 전용 고정 라인 세트 — shared/maps/quicklines.ts(QUICKLINES)를
// 이름으로 조회해 고정 순서(셔플 없음)로 반환한다. 시드는 server/src/seed/systemAssets.ts(npm run seed)가 담당.
import { QUICKLINES } from "shared/maps";
import { prisma } from "../prisma.js";
import type { LineWithPlacements } from "./resolveMemberLines.js";

const LINE_INCLUDE = { placements: { include: { asset: true } } } as const;

/** 고정 순서(셔플 없음) — QUICKLINES 배열 순서 그대로 DB에서 조회해 반환. */
export async function ensureQuickLines(): Promise<LineWithPlacements[]> {
  const lines: LineWithPlacements[] = [];
  for (const l of QUICKLINES) {
    const found = await prisma.mapLine.findFirst({ where: { name: l.name }, include: LINE_INCLUDE });
    if (!found) throw new Error(`${l.name} 미시드 — server에서 'npm run seed' 먼저 실행 필요`);
    lines.push(found);
  }
  return lines;
}
