// 간이 레이스(콘솔 startstart) 전용 고정 라인 — 순수 평지 + 끝에 골 깃발.
// DB에 "quick.flat" 이름으로 1회 생성해 재사용(클라 RaceScreen이 /api/lines/:id로 그대로 조회 가능).
import { prisma } from "../prisma.js";
import type { LineWithPlacements } from "./resolveMemberLines.js";

const LINE_INCLUDE = { placements: { include: { asset: true } } } as const;

const WIDTH_TILES = 40;

export async function ensureQuickLine(): Promise<LineWithPlacements> {
  const existing = await prisma.mapLine.findFirst({ where: { name: "quick.flat" }, include: LINE_INCLUDE });
  if (existing) return existing;

  const ground =
    (await prisma.asset.findFirst({ where: { category: "block", isSystem: true, name: { in: ["기본 땅", "ground"] } } })) ??
    (await prisma.asset.findFirst({ where: { category: "block", isSystem: true } }));
  if (!ground) throw new Error("quick.flat 생성 불가 — 시스템 block 에셋 없음(시드 확인)");
  const creator = await prisma.user.findFirst();
  if (!creator) throw new Error("quick.flat 생성 불가 — 유저가 하나도 없음");

  console.log(`[race] quick.flat 라인 최초 생성(폭 ${WIDTH_TILES}, ground=${ground.id})`);
  return prisma.mapLine.create({
    data: {
      creatorId: creator.id,
      name: "quick.flat",
      tileLength: WIDTH_TILES,
      startFlagX: 1, startFlagY: 17,
      endFlagX: WIDTH_TILES - 2, endFlagY: 17,
      isPublic: false,
      testPassedAt: new Date(),   // 병합 대상 조건(테스트 통과) 충족
      placements: {
        create: Array.from({ length: WIDTH_TILES }, (_, x) => ({ assetId: ground.id, x, y: 18, flipX: false })),
      },
    },
    include: LINE_INCLUDE,
  });
}
