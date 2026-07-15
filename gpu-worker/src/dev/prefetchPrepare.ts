// VPN이 필요한 단계(게이트웨이 외형 호출)만 지금 전부 끝내두고, ComfyUI 생성은 나중에(VPN 없이)
// 돌릴 수 있게 Orchestrator.prepare() 결과를 통째로 캐시한다. 검증 배치 8개: 아바타2(랜덤)+
// 몬스터2(랜덤)+블록2(brick 고정1 + 랜덤1)+배경2(랜덤). 각 자산의 모든 액션(deriveActions)에
// 대해 prepare()를 호출 — 액션마다 motionHint가 다르므로 프롬프트도 다 다르게 나온다.
// 실행: npx tsx gpu-worker/src/dev/prefetchPrepare.ts  (VPN+SSH터널+ComfyUI 켜진 상태에서)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveActions } from "shared/actions";
import { ACTIONS, type ActionName } from "shared/actions";
import { ComfyUIBackend } from "../backends/comfyui/client.js";
import { PromptGatewayClient } from "../llm/gatewayClient.js";
import { ServerClient, type JobPayload } from "../jobs/serverClient.js";
import { Orchestrator } from "../orchestrator/generateAsset.js";
import { pipelineConfig } from "../config/index.js";
import { ASSETS } from "../../../asset-sources/manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
try {
  process.loadEnvFile(path.join(ROOT, "gpu-worker", ".env"));
} catch {
  /* .env 없으면 셸 env */
}

const OUT_DIR = path.join(ROOT, "gpu-worker-prefetch");
mkdirSync(OUT_DIR, { recursive: true });

function pickRandom<T>(arr: T[], n: number, exclude: (x: T) => boolean = () => false): T[] {
  const pool = arr.filter((x) => !exclude(x));
  const out: T[] = [];
  const used = new Set<number>();
  while (out.length < n && used.size < pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(pool[i]);
  }
  return out;
}

async function main() {
  const backend = new ComfyUIBackend({ baseUrl: process.env.COMFYUI_URL ?? "http://127.0.0.1:8188" });
  const server = new ServerClient("http://127.0.0.1:0", undefined);

  const gatewayUrl = process.env.QWEN_GATEWAY_URL;
  if (!gatewayUrl) {
    console.error("[prefetch] QWEN_GATEWAY_URL 미설정 — 게이트웨이 없인 스텁만 나와서 이 스크립트 의미 없음. 중단.");
    process.exit(1);
  }
  const g = pipelineConfig.llmGateway;
  const gateway = new PromptGatewayClient({
    baseUrl: gatewayUrl,
    internalToken: process.env.QWEN_INTERNAL_TOKEN ?? "",
    maxConcurrency: g.maxConcurrency,
    timeoutMs: g.timeoutMs,
    maxRetries: g.maxRetries,
    retryBaseDelayMs: g.retryBaseDelayMs,
  });

  const health = await backend.healthCheck();
  console.log("[prefetch] ComfyUI healthCheck:", health, "(prepare 단계엔 불필요하지만 확인차)");

  // ---- 검증 배치 8개 선정 ----
  // ⚠️ background 카테고리 제외 — drawn 소스는 무조건 투명배경이어야 한다는 Stage1 정규화 전제가
  // "화면 전체를 불투명하게 채우는" 배경 그림과 근본적으로 안 맞음(실측 확인, 2026-07-16).
  // 크로마키 합성/제거 스테이지 전체를 배경 카테고리에 어떻게 적용할지 별도 설계 필요 — 지금은 보류.
  // 대신 avatar/monster/block에서 2개 더 채워 8개를 유지한다.
  const avatars = pickRandom(ASSETS.filter((a) => a.category === "avatar"), 3);
  const monsters = pickRandom(ASSETS.filter((a) => a.category === "monster"), 3);
  const brick = ASSETS.find((a) => a.id === "brick")!; // 아무 옵션 없는 기본 블록 — 고정 포함
  const blockRandom = pickRandom(ASSETS.filter((a) => a.category === "block" && a.id !== "brick"), 1);
  const batch = [...avatars, ...monsters, brick, ...blockRandom];

  console.log("[prefetch] 검증 배치 8개:", batch.map((a) => `${a.id}(${a.category})`).join(", "));

  const orch = new Orchestrator({ backend, server, gateway });
  const summary: Array<{ id: string; category: string; action: string; positive: string; negative: string }> = [];

  for (const asset of batch) {
    const srcPath = path.join(ROOT, "asset-sources", asset.file);
    (server as unknown as { fetchSourceImage: (u: string) => Promise<Buffer> }).fetchSourceImage = async () =>
      readFileSync(srcPath);

    const actions = deriveActions(asset.category as never, asset.attrs as never);
    const assetDir = path.join(OUT_DIR, asset.id);
    mkdirSync(assetDir, { recursive: true });

    for (const derived of actions) {
      const action = derived.name as ActionName;
      const spec = ACTIONS[action];
      const job: JobPayload = {
        jobId: `${asset.id}-${action}`,
        assetId: asset.id,
        name: asset.name,
        action,
        sourceImageUrl: `local://${asset.id}`,
        sourceType: "drawn",
        normPending: false,
        category: asset.category as never,
        tilesW: asset.tiles.w,
        tilesH: asset.tiles.h,
        prompt: null,
        motionHint: derived.motionHint,
        loop: spec.loop,
        returnsToStart: spec.returnsToStart,
        durationSec: spec.durationSec ?? null,
        poseHint: spec.poseHint ?? null,
        negativeExtra: spec.negativeExtra ?? [],
        skipLeadFrames: spec.skipLeadFrames ?? 0,
      };

      console.log(`[prefetch] ${asset.id} / ${action} — 게이트웨이 호출 중...`);
      const prep = await orch.prepare(job);

      // ComfyUI 없이도 나중에 그대로 재사용할 수 있게 직렬화(시작이미지 PNG는 별도 파일로)
      const actionDir = path.join(assetDir, action);
      mkdirSync(actionDir, { recursive: true });
      writeFileSync(path.join(actionDir, "start-image.png"), prep.startImagePng);
      writeFileSync(
        path.join(actionDir, "prep.json"),
        JSON.stringify(
          {
            job,
            positive: prep.positive,
            negative: prep.negative,
            width: prep.width,
            height: prep.height,
            fps: prep.fps,
            genFrameCount: prep.genFrameCount,
            chromaKeyHex: prep.chromaKeyHex,
            chromaMargin: prep.chromaMargin,
          },
          null,
          2,
        ),
      );
      summary.push({ id: asset.id, category: asset.category, action, positive: prep.positive, negative: prep.negative });
      console.log(`[prefetch] ${asset.id}/${action} 완료 — positive: ${prep.positive.slice(0, 90)}...`);
    }
  }

  writeFileSync(path.join(OUT_DIR, "_summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\n[prefetch] 전체 완료 — ${summary.length}개 잡의 프롬프트/시작이미지 캐시됨: ${OUT_DIR}`);
  console.log("[prefetch] 이제 VPN 없이 gpu-worker/src/dev/generateFromPrefetch.ts로 ComfyUI 생성만 이어서 하면 됨.");
}

main().catch((e) => {
  console.error("[prefetch] 실패:", e);
  process.exit(1);
});
