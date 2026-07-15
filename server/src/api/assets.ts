// 에셋 스프라이트 매니페스트 조회 — 클라(client/src/sprites)가 항상 이 형태 하나만 안다.
// 시스템 기본 에셋이든 유저 제작 에셋이든 같은 API·같은 응답 형태(§2026-07-16 설계).
// ready 상태인 AssetSprite만 내려준다 — 생성 중/실패인 액션은 응답에서 빠지고, 클라는
// idle 폴백 → 원본(sourceImage, 액션 시트 준비 전 다리 역할) → 그마저 없으면 사각형 폴백
// (client/src/sprites/view.ts)으로 처리한다.
import { Router, type Response } from "express";
import { prisma } from "../prisma.js";

export function assetsRouter(): Router {
  const r = Router();

  // 목록 조회 — 맵 에디터 창고용(2026-07-16 신규). 배치 가능 카테고리(block/monster/item)만.
  // status 무관하게 전부 반환 — 스프라이트 시트 준비 전이어도 sourceImage로 창고 썸네일은 가능.
  r.get("/api/assets", async (_req, res: Response) => {
    const assets = await prisma.asset.findMany({
      where: { category: { in: ["block", "monster", "item", "background"] } },
      select: {
        id: true, name: true, category: true, isSystem: true, creatorId: true,
        widthCells: true, heightCells: true, sourceImageUrl: true,
      },
      orderBy: { id: "asc" },
    });
    res.json(assets.map((a) => ({
      id: a.id.toString(),
      name: a.name,
      category: a.category,
      mine: !a.isSystem && a.creatorId !== null,
      w: a.widthCells ?? 1,
      h: a.heightCells ?? 1,
      sourceImageUrl: a.sourceImageUrl,
    })));
  });

  r.get("/api/assets/:id", async (req, res: Response) => {
    let id: bigint;
    try { id = BigInt(req.params.id); } catch { res.status(400).json({ error: "invalid id" }); return; }
    const asset = await prisma.asset.findUnique({
      where: { id },
      select: {
        id: true, category: true, sourceImageUrl: true, widthCells: true, heightCells: true,
        sprites: { where: { status: "ready" }, select: { action: true, sheetUrl: true, frameCount: true, frameW: true, frameH: true } },
      },
    });
    if (!asset) { res.status(404).json({ error: "not found" }); return; }
    res.json(toManifest(asset));
  });

  // 시스템 에셋을 이름으로 찾는 진입점 — 클라가 "기본 아바타"처럼 하드코딩된 이름 하나로 시작점을 잡는 용도.
  r.get("/api/assets/by-name/:name", async (req, res: Response) => {
    const asset = await prisma.asset.findFirst({
      where: { isSystem: true, name: req.params.name },
      select: {
        id: true, category: true, sourceImageUrl: true, widthCells: true, heightCells: true,
        sprites: { where: { status: "ready" }, select: { action: true, sheetUrl: true, frameCount: true, frameW: true, frameH: true } },
      },
    });
    if (!asset) { res.status(404).json({ error: "not found" }); return; }
    res.json(toManifest(asset));
  });

  return r;
}

interface AssetWithSprites {
  id: bigint; category: string;
  sourceImageUrl: string; widthCells: number | null; heightCells: number | null;
  sprites: { action: string; sheetUrl: string | null; frameCount: number | null; frameW: number | null; frameH: number | null }[];
}

/** 카테고리별 원본 그림 타일 크기 — 아바타는 컬럼이 NULL(1×2 고정), 그 외는 widthCells/heightCells. */
function sourceTiles(asset: AssetWithSprites): { w: number; h: number } {
  if (asset.category === "avatar") return { w: 1, h: 2 };
  return { w: asset.widthCells ?? 1, h: asset.heightCells ?? 1 };
}

function toManifest(asset: AssetWithSprites) {
  const actions: Record<string, { url: string; frameCount: number; frameW: number; frameH: number }> = {};
  for (const s of asset.sprites) {
    if (!s.sheetUrl || !s.frameCount || !s.frameW || !s.frameH) continue;   // 완전히 준비된 것만
    actions[s.action] = { url: s.sheetUrl, frameCount: s.frameCount, frameW: s.frameW, frameH: s.frameH };
  }
  const { w, h } = sourceTiles(asset);
  return {
    key: asset.id.toString(), category: asset.category, actions,
    // 원본 폴백(②)용 — 패딩 없는 정지그림 1장. 크기는 타일수 기반으로 정확히 계산됨(추정 아님).
    sourceImage: { url: asset.sourceImageUrl, tilesW: w, tilesH: h },
  };
}
