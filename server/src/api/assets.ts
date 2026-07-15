// 에셋 스프라이트 매니페스트 조회 — 클라(client/src/sprites)가 항상 이 형태 하나만 안다.
// 시스템 기본 에셋이든 유저 제작 에셋이든 같은 API·같은 응답 형태(§2026-07-16 설계).
// ready 상태인 AssetSprite만 내려준다 — 생성 중/실패인 액션은 응답에서 빠지고, 클라는
// idle 폴백 → 그마저 없으면 사각형 폴백(client/src/sprites/view.ts)으로 처리한다.
import { Router, type Response } from "express";
import { prisma } from "../prisma.js";

export function assetsRouter(): Router {
  const r = Router();

  r.get("/api/assets/:id", async (req, res: Response) => {
    let id: bigint;
    try { id = BigInt(req.params.id); } catch { res.status(400).json({ error: "invalid id" }); return; }
    const asset = await prisma.asset.findUnique({
      where: { id },
      select: { id: true, category: true, sprites: { where: { status: "ready" }, select: { action: true, sheetUrl: true, frameCount: true, frameW: true, frameH: true } } },
    });
    if (!asset) { res.status(404).json({ error: "not found" }); return; }
    res.json(toManifest(asset));
  });

  // 시스템 에셋을 이름으로 찾는 진입점 — 클라가 "기본 아바타"처럼 하드코딩된 이름 하나로 시작점을 잡는 용도.
  r.get("/api/assets/by-name/:name", async (req, res: Response) => {
    const asset = await prisma.asset.findFirst({
      where: { isSystem: true, name: req.params.name },
      select: { id: true, category: true, sprites: { where: { status: "ready" }, select: { action: true, sheetUrl: true, frameCount: true, frameW: true, frameH: true } } },
    });
    if (!asset) { res.status(404).json({ error: "not found" }); return; }
    res.json(toManifest(asset));
  });

  return r;
}

interface AssetWithSprites {
  id: bigint; category: string;
  sprites: { action: string; sheetUrl: string | null; frameCount: number | null; frameW: number | null; frameH: number | null }[];
}

function toManifest(asset: AssetWithSprites) {
  const actions: Record<string, { url: string; frameCount: number; frameW: number; frameH: number }> = {};
  for (const s of asset.sprites) {
    if (!s.sheetUrl || !s.frameCount || !s.frameW || !s.frameH) continue;   // 완전히 준비된 것만
    actions[s.action] = { url: s.sheetUrl, frameCount: s.frameCount, frameW: s.frameW, frameH: s.frameH };
  }
  return { key: asset.id.toString(), category: asset.category, actions };
}
