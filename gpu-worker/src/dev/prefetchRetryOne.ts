// prefetchPrepare.ts 배치 중 게이트웨이 일시 오류(MODEL_OUTPUT_INVALID)로 실패한 항목 하나만 재시도.
// 실행: npx tsx gpu-worker/src/dev/prefetchRetryOne.ts <assetId>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveActions, ACTIONS, type ActionName } from "shared/actions";
import { ComfyUIBackend } from "../backends/comfyui/client.js";
import { PromptGatewayClient } from "../llm/gatewayClient.js";
import { ServerClient, type JobPayload } from "../jobs/serverClient.js";
import { Orchestrator } from "../orchestrator/generateAsset.js";
import { pipelineConfig } from "../config/index.js";
import { ASSETS } from "../../../asset-sources/manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
try { process.loadEnvFile(path.join(ROOT, "gpu-worker", ".env")); } catch {}

const OUT_DIR = path.join(ROOT, "gpu-worker-prefetch");
const targetId = process.argv[2];
const asset = ASSETS.find((a) => a.id === targetId);
if (!asset) { console.error("자산 못 찾음:", targetId); process.exit(1); }

async function main() {
  const backend = new ComfyUIBackend({ baseUrl: process.env.COMFYUI_URL ?? "http://127.0.0.1:8188" });
  const server = new ServerClient("http://127.0.0.1:0", undefined);
  const g = pipelineConfig.llmGateway;
  const gateway = new PromptGatewayClient({
    baseUrl: process.env.QWEN_GATEWAY_URL!,
    internalToken: process.env.QWEN_INTERNAL_TOKEN ?? "",
    maxConcurrency: g.maxConcurrency, timeoutMs: g.timeoutMs,
    maxRetries: 3, retryBaseDelayMs: 500, // 재시도 좀 더 공격적으로
  });
  const orch = new Orchestrator({ backend, server, gateway });

  const srcPath = path.join(ROOT, "asset-sources", asset!.file);
  (server as unknown as { fetchSourceImage: (u: string) => Promise<Buffer> }).fetchSourceImage = async () =>
    readFileSync(srcPath);

  const actions = deriveActions(asset!.category as never, asset!.attrs as never);
  const assetDir = path.join(OUT_DIR, asset!.id);
  mkdirSync(assetDir, { recursive: true });

  for (const derived of actions) {
    const action = derived.name as ActionName;
    const spec = ACTIONS[action];
    const job: JobPayload = {
      jobId: `${asset!.id}-${action}`, assetId: asset!.id, name: asset!.name, action,
      sourceImageUrl: `local://${asset!.id}`, sourceType: "drawn", normPending: false,
      category: asset!.category as never, tilesW: asset!.tiles.w, tilesH: asset!.tiles.h,
      prompt: null, motionHint: derived.motionHint, loop: spec.loop,
      returnsToStart: spec.returnsToStart, durationSec: spec.durationSec ?? null,
      poseHint: spec.poseHint ?? null, negativeExtra: spec.negativeExtra ?? [],
      skipLeadFrames: spec.skipLeadFrames ?? 0,
    };
    console.log(`[retry] ${asset!.id}/${action} 재시도 중...`);
    const prep = await orch.prepare(job);
    const actionDir = path.join(assetDir, action);
    mkdirSync(actionDir, { recursive: true });
    writeFileSync(path.join(actionDir, "start-image.png"), prep.startImagePng);
    writeFileSync(path.join(actionDir, "prep.json"), JSON.stringify({
      job, positive: prep.positive, negative: prep.negative, width: prep.width, height: prep.height,
      fps: prep.fps, genFrameCount: prep.genFrameCount, chromaKeyHex: prep.chromaKeyHex, chromaMargin: prep.chromaMargin,
    }, null, 2));
    console.log(`[retry] ${asset!.id}/${action} 완료 — positive: ${prep.positive}`);
  }
}
main().catch((e) => { console.error("[retry] 실패:", e); process.exit(1); });
