// 일회성 실측 스크립트 — 서버/DB 없이 오케스트레이터를 직접 호출해 "톱니바퀴 idle이 실제로
// 회전하는가"를 확인한다. 큐를 거치지 않고 prepare/generate/finish를 순서대로 호출.
// 실행: npx tsx gpu-worker/src/dev/testSawbladeIdle.ts  (레포 루트에서)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ACTIONS, fullMotionHint } from "shared/actions";
import { ComfyUIBackend } from "../backends/comfyui/client.js";
import { ServerClient, type JobPayload } from "../jobs/serverClient.js";
import { Orchestrator } from "../orchestrator/generateAsset.js";
import { frameToPng } from "../image/raster.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
try {
  process.loadEnvFile(path.join(ROOT, "gpu-worker", ".env"));
} catch {
  /* .env 없으면 셸 env */
}

const OUT_DIR = path.join(ROOT, "gpu-worker-test-out");
mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const comfyUrl = process.env.COMFYUI_URL ?? "http://127.0.0.1:8188";
  const backend = new ComfyUIBackend({ baseUrl: comfyUrl });
  // 소스 이미지는 로컬 파일에서 직접 읽으므로 baseUrl은 미사용(더미).
  const server = new ServerClient("http://127.0.0.1:0", undefined);

  const health = await backend.healthCheck();
  console.log("[test] ComfyUI healthCheck:", health);
  if (!health.ok) {
    console.error("[test] ComfyUI 응답 없음 — 중단");
    process.exit(1);
  }

  const orch = new Orchestrator({ backend, server }); // gateway 없음 = 스텁 외형

  const idleSpec = ACTIONS.idle;
  const job: JobPayload = {
    jobId: "test-sawblade-idle",
    assetId: "test-sawblade",
    name: "spinning sawblade hazard, toothed steel blade",
    action: "idle",
    // 로컬 파일 경로를 file:// 대신, fetchSourceImage가 http(s)만 다루므로 직접 버퍼 주입 경로로 우회.
    sourceImageUrl: "local://sawblade",
    sourceType: "drawn",
    normPending: false,
    category: "block",
    tilesW: 1,
    tilesH: 1,
    prompt: null,
    motionHint: fullMotionHint(idleSpec),
    loop: idleSpec.loop,
    returnsToStart: idleSpec.returnsToStart,
    durationSec: idleSpec.durationSec ?? null,
    poseHint: idleSpec.poseHint ?? null,
    negativeExtra: idleSpec.negativeExtra ?? [],
    skipLeadFrames: idleSpec.skipLeadFrames ?? 0,
  };

  // ServerClient.fetchSourceImage는 http(s)만 지원하므로, local:// 스킴은 여기서 직접 패치.
  const sourcePath = path.join(ROOT, "gpu-worker-test-sawblade.png");
  (server as unknown as { fetchSourceImage: (u: string) => Promise<Buffer> }).fetchSourceImage = async () =>
    readFileSync(sourcePath);

  console.log("[test] motionHint:", job.motionHint);
  console.log("[test] poseHint:", job.poseHint);

  console.log("[test] prepare...");
  const prep = await orch.prepare(job);
  console.log("[test] wan positive prompt:\n ", prep.positive);
  console.log("[test] wan negative prompt:\n ", prep.negative);
  console.log("[test] 생성 해상도:", prep.width, "x", prep.height, "프레임수:", prep.genFrameCount, "fps:", prep.fps);
  writeFileSync(path.join(OUT_DIR, "start-image-chroma.png"), prep.startImagePng);

  console.log("[test] generate (ComfyUI)... 시간 걸림");
  const rawFrames = await orch.generate(prep);
  console.log("[test] 원본 프레임 수:", rawFrames.length);
  for (let i = 0; i < rawFrames.length; i++) {
    const png = await frameToPng(rawFrames[i]);
    writeFileSync(path.join(OUT_DIR, `raw-${String(i).padStart(2, "0")}.png`), png);
  }

  console.log("[test] finish (Stage5 후처리)...");
  const sheet = await orch.finish(prep, rawFrames);
  writeFileSync(path.join(OUT_DIR, "sheet.png"), sheet.png);
  console.log("[test] 완료 —", sheet.frameCount, "프레임,", sheet.frameW, "x", sheet.frameH);
  console.log("[test] 출력 폴더:", OUT_DIR);
}

main().catch((e) => {
  console.error("[test] 실패:", e);
  process.exit(1);
});
