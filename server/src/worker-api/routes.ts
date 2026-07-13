// 워커(5080 ComfyUI)용 pull API + 에셋 제출 엔드포인트. (archive: sprite-pipeline-next.md §B)
//
// pull 모델: 워커는 NAT 뒤라 백엔드가 워커를 못 부른다. 워커가 폴링·claim·업로드만 한다.
//   GET  /api/ai/jobs/next            큐에서 1건 원자적 claim (queued→generating)
//   POST /api/ai/jobs/:id/result      시트 업로드 완료 (generating→ready)
//   POST /api/ai/jobs/:id/fail        실패 보고 (재큐 or failed)
//   POST /api/asset/submit            (테스트/프론트) 에셋 제출 → 큐 적재
//
// 인증: WORKER_TOKEN 환경변수가 있으면 x-worker-token 헤더로 검증(없으면 개발용으로 통과).
import express, { Router, type Request, type Response, type NextFunction } from "express";
import { type Category, parseAttrs } from "shared/schemas";
import { deriveActions, ACTIONS, type ActionName } from "shared/actions";
import { prisma, jsonSafe } from "../prisma.js";
import { submitAsset } from "../asset/queue.js";

/** claim 후 이 시간(ms) 넘게 generating이면 워커가 죽은 것으로 보고 재큐. */
const STALE_MS = 5 * 60_000;
/** 재시도 상한 — 넘으면 failed. */
const MAX_ATTEMPTS = 3;

function requireWorker(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.WORKER_TOKEN;
  if (!expected) return next(); // 개발 편의: 토큰 미설정 시 통과
  if (req.header("x-worker-token") !== expected) {
    res.status(401).json({ error: "unauthorized worker" });
    return;
  }
  next();
}

/** 스테일(죽은 워커가 잡은) 잡을 큐로 되돌린다. jobs/next 진입 시 기회적으로 호출. */
async function requeueStale() {
  const cutoff = new Date(Date.now() - STALE_MS);
  await prisma.assetSprite.updateMany({
    where: { status: "generating", claimedAt: { lt: cutoff } },
    data: { status: "queued", claimedAt: null },
  });
}

/** 워커에게 넘길 잡 페이로드. 워커는 deriveActions를 모름 — 여기서 전부 계산해 실어준다. */
function buildJobPayload(sprite: { id: bigint; action: string; prompt: string | null }, asset: {
  id: bigint; category: string; attrs: unknown; sourceImageUrl: string;
}) {
  const action = sprite.action as ActionName;
  const spec = ACTIONS[action];
  // attrs별 motionHint override(예: 빠른 보행 → briskly)를 반영해 이 액션의 힌트를 꺼낸다.
  const derived = deriveActions(asset.category as Category, asset.attrs as never);
  const motionHint = derived.find((d) => d.name === action)?.motionHint ?? spec.motionHint;
  return jsonSafe({
    jobId: sprite.id,
    assetId: asset.id,
    action,
    sourceImageUrl: asset.sourceImageUrl,
    category: asset.category,
    // prompt는 Qwen 확장(§C) 전까지 NULL — 워커/오케스트레이터가 motionHint+spec로 조립.
    prompt: sprite.prompt,
    motionHint,
    loop: spec.loop,
    returnsToStart: spec.returnsToStart,
    durationSec: spec.durationSec ?? null,
    poseHint: spec.poseHint ?? null,
    negativeExtra: spec.negativeExtra ?? [],
  });
}

export function aiWorkerRouter(): Router {
  const r = Router();
  r.use(express.json({ limit: "2mb" })); // 잡 결과·attrs JSON 파싱

  // --- 제출: 에셋 → 큐 적재 (프론트/테스트) ---
  r.post("/api/asset/submit", async (req: Request, res: Response) => {
    try {
      const b = req.body ?? {};
      const asset = await submitAsset({
        creatorId: b.creatorId != null ? BigInt(b.creatorId) : null,
        category: b.category as Category,
        name: b.name,
        description: b.description ?? null,
        attrs: b.attrs,
        sourceImageUrl: b.sourceImageUrl,
        isSystem: b.isSystem ?? false,
      });
      res.status(201).json(jsonSafe(asset));
    } catch (e: any) {
      // ZodError(검증 실패) → 400, 그 외 → 500
      const status = e?.name === "ZodError" ? 400 : 500;
      res.status(status).json({ error: e?.message ?? "submit failed", issues: e?.issues });
    }
  });

  // --- 워커: 다음 잡 claim ---
  r.get("/api/ai/jobs/next", requireWorker, async (_req: Request, res: Response) => {
    try {
      await requeueStale();
      const claimed = await prisma.$transaction(async (tx) => {
        // FOR UPDATE SKIP LOCKED: 동시 워커가 같은 잡을 잡지 않게 (MySQL 8 InnoDB).
        const rows = await tx.$queryRaw<{ id: bigint }[]>`
          SELECT id FROM AssetSprite
          WHERE status = 'queued'
          ORDER BY priority DESC, id ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED`;
        if (rows.length === 0) return null;
        const id = rows[0].id;
        await tx.assetSprite.update({
          where: { id },
          data: { status: "generating", claimedAt: new Date(), attempts: { increment: 1 } },
        });
        return tx.assetSprite.findUnique({ where: { id }, include: { asset: true } });
      });
      if (!claimed) {
        res.status(204).end(); // 큐 빔
        return;
      }
      res.json(buildJobPayload(claimed, claimed.asset));
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "claim failed" });
    }
  });

  // --- 워커: 결과 업로드 (시트 완성) ---
  r.post("/api/ai/jobs/:id/result", requireWorker, async (req: Request, res: Response) => {
    try {
      const id = BigInt(req.params.id);
      const b = req.body ?? {};
      if (!b.sheetUrl) {
        res.status(400).json({ error: "sheetUrl required" });
        return;
      }
      const updated = await prisma.assetSprite.update({
        where: { id },
        data: {
          status: "ready",
          sheetUrl: b.sheetUrl,
          frameCount: b.frameCount ?? null,
          frameW: b.frameW ?? null,
          frameH: b.frameH ?? null,
          errorMsg: null,
        },
      });
      // 이 에셋의 모든 스프라이트가 ready면 에셋도 ready.
      const remaining = await prisma.assetSprite.count({
        where: { assetId: updated.assetId, status: { not: "ready" } },
      });
      if (remaining === 0) {
        await prisma.asset.update({ where: { id: updated.assetId }, data: { status: "ready" } });
      }
      res.json(jsonSafe({ ok: true, assetReady: remaining === 0 }));
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "result failed" });
    }
  });

  // --- 워커: 실패 보고 (재큐 or failed) ---
  r.post("/api/ai/jobs/:id/fail", requireWorker, async (req: Request, res: Response) => {
    try {
      const id = BigInt(req.params.id);
      const errorMsg = (req.body?.errorMsg ?? "unknown").toString().slice(0, 190);
      const sprite = await prisma.assetSprite.findUnique({ where: { id } });
      if (!sprite) {
        res.status(404).json({ error: "job not found" });
        return;
      }
      const requeue = sprite.attempts < MAX_ATTEMPTS;
      await prisma.assetSprite.update({
        where: { id },
        data: { status: requeue ? "queued" : "failed", claimedAt: null, errorMsg },
      });
      res.json({ ok: true, requeued: requeue });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "fail-report failed" });
    }
  });

  return r;
}
