// MapLine 저장/조회 API — 에디터 저장·재사용 브라우징·완주 판정(별도 작업)의 공통 입출력.
// POST는 "제출"일 뿐 testPassedAt을 설정하지 않는다 — 완주 판정이 별도로 채운다(§lines.ts 설계).
import express, { Router, type Response } from "express";
import { validateLineData, type LineData } from "shared/maps";
import { prisma, jsonSafe } from "../prisma.js";
import { requireUser, type AuthedRequest } from "./auth.js";

const LINE_INCLUDE = { placements: { include: { asset: true } } } as const;

interface LinePlacementBody {
  assetId: string | number;
  x: number; y: number;
  flipX?: boolean;
  endX?: number; endY?: number;
}
interface LineBody {
  name?: string;
  tileLength: number;
  startFlag: { x: number; y: number };
  endFlag: { x: number; y: number };
  placements: LinePlacementBody[];
  roomCode?: string;
  isPublic?: boolean;
}

export function linesRouter(): Router {
  const r = Router();
  r.use(express.json({ limit: "1mb" }));

  // 저장: 인증 필요, validateLineData로 라인 규칙(폭 상한·깃발 순서) 검증
  r.post("/api/lines", requireUser, async (req: AuthedRequest, res: Response) => {
    const b = req.body as LineBody;
    if (!b?.placements || !Array.isArray(b.placements) || !b.startFlag || !b.endFlag) {
      res.status(400).json({ error: "invalid line body" });
      return;
    }
    const asLineData: LineData = {
      name: b.name ?? "", tileLength: b.tileLength,
      startFlag: b.startFlag, endFlag: b.endFlag,
      placements: b.placements.map((p) => ({ assetKey: String(p.assetId), x: p.x, y: p.y, flipX: p.flipX, endX: p.endX, endY: p.endY })),
    };
    const err = validateLineData(asLineData);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }

    const assetIds = b.placements.map((p) => BigInt(p.assetId));
    const assets = await prisma.asset.findMany({ where: { id: { in: assetIds } }, select: { id: true, category: true } });
    const byId = new Map(assets.map((a) => [a.id.toString(), a.category]));
    for (const p of b.placements) {
      const cat = byId.get(String(p.assetId));
      if (!cat) { res.status(400).json({ error: `asset not found: ${p.assetId}` }); return; }
      // item 허용 추가(2026-07-16) — loadLine이 attrs.effect→ItemKind로 실체화
      if (cat !== "block" && cat !== "monster" && cat !== "item") { res.status(400).json({ error: `asset ${p.assetId} category '${cat}' not placeable` }); return; }
    }

    const created = await prisma.mapLine.create({
      data: {
        creatorId: req.user!.id,
        name: b.name || null,
        tileLength: b.tileLength,
        startFlagX: b.startFlag.x, startFlagY: b.startFlag.y,
        endFlagX: b.endFlag.x, endFlagY: b.endFlag.y,
        isPublic: b.isPublic ?? false,
        sourceRoomId: b.roomCode ?? null,
        placements: {
          create: b.placements.map((p) => ({
            assetId: BigInt(p.assetId), x: p.x, y: p.y,
            flipX: p.flipX ?? false, endX: p.endX ?? null, endY: p.endY ?? null,
          })),
        },
      },
      include: LINE_INCLUDE,
    });
    res.status(201).json(jsonSafe({ lineId: created.id, line: created }));
  });

  // 조회: 내가 만든 라인 (에디터 불러오기)
  r.get("/api/lines/mine", requireUser, async (req: AuthedRequest, res: Response) => {
    const lines = await prisma.mapLine.findMany({
      where: { creatorId: req.user!.id },
      orderBy: { createdAt: "desc" },
      include: LINE_INCLUDE,
    });
    res.json(jsonSafe(lines));
  });

  // 조회: 재사용 가능 풀 (공개 + 테스트 완료) — 인증 불필요
  r.get("/api/lines/pool", async (_req, res: Response) => {
    const lines = await prisma.mapLine.findMany({
      where: { isPublic: true, testPassedAt: { not: null } },
      orderBy: { updatedAt: "desc" },
      include: LINE_INCLUDE,
    });
    res.json(jsonSafe(lines));
  });

  // 조회: 라인 상세
  r.get("/api/lines/:id", async (req, res: Response) => {
    const line = await prisma.mapLine.findUnique({ where: { id: BigInt(req.params.id) }, include: LINE_INCLUDE });
    if (!line) { res.status(404).json({ error: "not found" }); return; }
    res.json(jsonSafe(line));
  });

  return r;
}
