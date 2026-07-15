// 워커(5080 ComfyUI)용 pull API + 에셋 제출 엔드포인트. (archive: sprite-pipeline-next.md §B)
//
// pull 모델: 워커는 NAT 뒤라 백엔드가 워커를 못 부른다. 워커가 폴링·claim·업로드만 한다.
//   GET  /api/ai/jobs/next            큐에서 1건 원자적 claim (queued→generating)
//   POST /api/ai/jobs/:id/result      시트 업로드 완료 (generating→ready)
//   POST /api/ai/jobs/:id/fail        실패 보고 (재큐 or failed)
//   POST /api/asset/submit            (테스트/프론트) 에셋 제출 → 큐 적재
//
// 인증: WORKER_TOKEN 환경변수가 있으면 x-worker-token 헤더로 검증(없으면 개발용으로 통과).
import { randomBytes } from "node:crypto";
import express, { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import type { Prisma } from "@prisma/client";
import { type Category } from "shared/schemas";
import { deriveActions, ACTIONS, fullMotionHint, type ActionName } from "shared/actions";
import { prisma, jsonSafe } from "../prisma.js";
import { submitAsset } from "../asset/queue.js";
import { saveSheetPng, saveSourcePng } from "../asset/storage.js";
import { ingestUploadedImage } from "../asset/sourceNormalize.js";

/**
 * claim 후 이 시간(ms) 넘게 generating이면 워커가 죽은 것으로 보고 재큐.
 * 워커 프리페치(생성 중 다음 잡 미리 claim) 때문에 잡은 최대 "앞 잡 생성 1건 + 자기 생성
 * (타임아웃 10분)"까지 정상적으로 generating일 수 있다 — 그보다 넉넉히.
 */
const STALE_MS = 15 * 60_000;
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
  id: bigint; name: string; category: string; attrs: unknown; sourceImageUrl: string;
  sourceType: string; normSourceUrl: string | null;
  widthCells: number | null; heightCells: number | null;
}) {
  const action = sprite.action as ActionName;
  const spec = ACTIONS[action];
  // attrs별 motionHint override(예: 빠른 보행 → briskly)를 반영해 이 액션의 힌트를 꺼낸다.
  const derived = deriveActions(asset.category as Category, asset.attrs as never);
  const motionHint = derived.find((d) => d.name === action)?.motionHint ?? fullMotionHint(spec);
  return jsonSafe({
    jobId: sprite.id,
    assetId: asset.id,
    name: asset.name,
    action,
    // 정규화본이 있으면 그것을 소스로 — 워커의 AI 매팅 1회 결과를 같은 에셋 후속 잡이 재사용.
    sourceImageUrl: asset.normSourceUrl ?? asset.sourceImageUrl,
    sourceType: asset.sourceType,
    // uploaded인데 정규화본이 아직 없음 = 워커가 Stage 1에서 AI 매팅을 수행해야 함.
    normPending: asset.sourceType === "uploaded" && asset.normSourceUrl == null,
    category: asset.category,
    // 생성/다운스케일 해상도 유도용 — 콜라이더 셀 크기(없으면 1타일).
    tilesW: asset.widthCells ?? 1,
    tilesH: asset.heightCells ?? 1,
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

  // --- 업로드: 소스 이미지 수령 (multipart "image" 필드) ---
  // 검증·EXIF 회전·다운스케일·PNG 재인코딩 후, 싼 배경 분리(flood-fill)를 즉시 시도한다.
  // 성공 → normUrl까지 반환(유저가 제출 순간 누끼 미리보기 가능). 실패 → needsAiNorm=true,
  // 제출 시 워커가 Stage 1에서 AI 매팅으로 처리. 응답 URL들을 그대로 /api/asset/submit에 넘기면 됨.
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  r.post("/api/asset/upload-source", upload.single("image"), async (req: Request, res: Response) => {
    try {
      if (!req.file?.buffer?.length) {
        res.status(400).json({ error: "multipart 'image' file required" });
        return;
      }
      const ingested = await ingestUploadedImage(req.file.buffer);
      const id = randomBytes(8).toString("hex");
      const rawUrl = await saveSourcePng(`${id}_raw`, ingested.rawPng);
      const normUrl = ingested.normPng ? await saveSourcePng(`${id}_norm`, ingested.normPng) : null;
      res.status(201).json({
        rawUrl,
        normUrl,
        needsAiNorm: normUrl == null,
        width: ingested.width,
        height: ingested.height,
      });
    } catch (e: any) {
      // sharp 포맷/손상 오류는 유저 입력 문제 → 400
      res.status(400).json({ error: e?.message ?? "upload failed" });
    }
  });

  // --- 제출: 에셋 → 큐 적재 (프론트/테스트) ---
  r.post("/api/asset/submit", async (req: Request, res: Response) => {
    try {
      const b = req.body ?? {};
      const sourceType = b.sourceType === "uploaded" ? "uploaded" : "drawn";
      const asset = await submitAsset({
        creatorId: b.creatorId != null ? BigInt(b.creatorId) : null,
        category: b.category as Category,
        name: b.name,
        description: b.description ?? null,
        attrs: b.attrs,
        // uploaded는 upload-source 응답의 normUrl(있으면) 또는 rawUrl을 sourceImageUrl로.
        sourceImageUrl: b.sourceImageUrl,
        sourceType,
        rawSourceUrl: sourceType === "uploaded" ? (b.rawSourceUrl ?? null) : null,
        normSourceUrl: sourceType === "uploaded" ? (b.normSourceUrl ?? null) : null,
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
      const claimed = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

  // --- 워커: 결과 업로드 (시트 PNG raw 바디 + 메타는 쿼리) ---
  r.post(
    "/api/ai/jobs/:id/result",
    requireWorker,
    express.raw({ type: "image/png", limit: "20mb" }),
    async (req: Request, res: Response) => {
      try {
        const id = BigInt(req.params.id);
        const png = req.body as Buffer;
        if (!Buffer.isBuffer(png) || png.length === 0) {
          res.status(400).json({ error: "png body required (Content-Type: image/png)" });
          return;
        }
        const sheetUrl = await saveSheetPng(id.toString(), png);
        const num = (q: unknown) => (q != null && q !== "" ? Number(q) : null);
        const updated = await prisma.assetSprite.update({
          where: { id },
          data: {
            status: "ready",
            sheetUrl,
            frameCount: num(req.query.frameCount),
            frameW: num(req.query.frameW),
            frameH: num(req.query.frameH),
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
    },
  );

  // --- 워커: AI 매팅으로 만든 정규화 소스 등록 (에셋당 1회) ---
  // 첫 잡에서 매팅에 성공하면 여기로 올린다 → normSourceUrl이 채워져 같은 에셋의 나머지 잡·
  // 다른 워커·재생성이 매팅을 반복하지 않는다 (jobs/next가 normSourceUrl을 소스로 내려줌).
  r.post(
    "/api/ai/assets/:id/norm-source",
    requireWorker,
    express.raw({ type: "image/png", limit: "10mb" }),
    async (req: Request, res: Response) => {
      try {
        const id = BigInt(req.params.id);
        const png = req.body as Buffer;
        if (!Buffer.isBuffer(png) || png.length === 0) {
          res.status(400).json({ error: "png body required (Content-Type: image/png)" });
          return;
        }
        const normSourceUrl = await saveSourcePng(`${id}_norm`, png);
        await prisma.asset.update({ where: { id }, data: { normSourceUrl } });
        res.json({ ok: true, normSourceUrl });
      } catch (e: any) {
        res.status(500).json({ error: e?.message ?? "norm-source failed" });
      }
    },
  );

  // --- 워커: 소스 정규화 실패 보고 (에셋 단위 즉시 실패) ---
  // 배경 분리가 불가능한 이미지는 어떤 액션 잡도 성공할 수 없다 — 잡별 재시도(3액션×3회 =
  // 최대 9회 GPU 클레임)로 낭비하지 않고 에셋의 모든 잡을 한 번에 failed 처리한다.
  r.post("/api/ai/assets/:id/norm-fail", requireWorker, async (req: Request, res: Response) => {
    try {
      const id = BigInt(req.params.id);
      const errorMsg = (req.body?.errorMsg ?? "source normalization failed").toString().slice(0, 190);
      const updated = await prisma.assetSprite.updateMany({
        where: { assetId: id, status: { in: ["queued", "generating"] } },
        data: { status: "failed", claimedAt: null, errorMsg },
      });
      await prisma.asset.update({ where: { id }, data: { status: "failed" } });
      res.json({ ok: true, failedSprites: updated.count });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "norm-fail failed" });
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
