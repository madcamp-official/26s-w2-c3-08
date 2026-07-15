// 실험 C/D/E — 실험 A(고정 정지 문구)·B(적응형 문구) 둘 다 회전 실패 후, 원인 격리 진단.
// 용의자 둘: (1) 안정화 문구의 "subject stays in place" (2) cfg=1/steps=4(Lightning) 저정합도.
// motionHint는 가장 명확한 "계속 자전" 지시로 고정해 모션힌트 자체의 모호함 변수는 제거.
//   C: stays-in-place 제거,        cfg/steps 기본(1/4)
//   D: stays-in-place 유지,        cfg/steps 상향(3/10) — 진단용, 운영 설정 아님
//   E: stays-in-place 제거 + cfg/steps 상향(3/10)
// 실행: npx tsx gpu-worker/src/dev/testSawbladeIdleDiag.ts  (레포 루트에서)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ComfyUIBackend } from "../backends/comfyui/client.js";
import { ServerClient, type JobPayload } from "../jobs/serverClient.js";
import { Orchestrator } from "../orchestrator/generateAsset.js";
import { frameToPng } from "../image/raster.js";
import { pipelineConfig } from "../config/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
try {
  process.loadEnvFile(path.join(ROOT, "gpu-worker", ".env"));
} catch {
  /* .env 없으면 셸 env */
}

const MOTION_STRONG =
  "continuously rotating in place around its own center at a steady constant speed, " +
  "like a spinning gear or circular saw blade, one full rotation looping seamlessly";
const POSE_STRONG = "continuous spinning motion, rotating steadily, no camera movement, position fixed";

const STAB_FULL =
  "single character centered in frame, full body visible, static locked camera, subject stays in place, " +
  "plain solid {bg} chroma background, seamless looping animation, clean 2D platformer game sprite";
const STAB_NO_STAYINPLACE =
  "single character centered in frame, full body visible, static locked camera, " +
  "plain solid {bg} chroma background, seamless looping animation, clean 2D platformer game sprite";

interface Variant {
  key: string;
  label: string;
  stabilization: string;
  steps: number;
  cfg: number;
}
const VARIANTS: Variant[] = [
  { key: "C", label: "stays-in-place 제거 / cfg-steps 기본(1,4)", stabilization: STAB_NO_STAYINPLACE, steps: 4, cfg: 1 },
  { key: "D", label: "stays-in-place 유지 / cfg-steps 상향(3,10)", stabilization: STAB_FULL, steps: 10, cfg: 3 },
  { key: "E", label: "stays-in-place 제거 / cfg-steps 상향(3,10)", stabilization: STAB_NO_STAYINPLACE, steps: 10, cfg: 3 },
];

async function runVariant(v: Variant, backend: ComfyUIBackend, server: ServerClient) {
  console.log(`\n===== 실험 ${v.key}: ${v.label} =====`);
  const OUT_DIR = path.join(ROOT, `gpu-worker-test-out-${v.key}`);
  mkdirSync(OUT_DIR, { recursive: true });

  // 이 실험만의 설정으로 싱글턴 뮤테이션 (pipeline.json 파일은 안 건드림, 프로세스 메모리에서만)
  pipelineConfig.prompt.stabilizationPositive = v.stabilization;
  pipelineConfig.generation.model.steps = v.steps;
  pipelineConfig.generation.model.cfg = v.cfg;

  const orch = new Orchestrator({ backend, server });
  const job: JobPayload = {
    jobId: `test-sawblade-${v.key}`,
    assetId: `test-sawblade-${v.key}`,
    name: "spinning sawblade hazard, toothed steel blade",
    action: "idle",
    sourceImageUrl: "local://sawblade",
    sourceType: "drawn",
    normPending: false,
    category: "block",
    tilesW: 1,
    tilesH: 1,
    prompt: null,
    motionHint: MOTION_STRONG,
    loop: true,
    returnsToStart: false,
    durationSec: null,
    poseHint: POSE_STRONG,
    negativeExtra: [],
    skipLeadFrames: 0,
  };
  const sourcePath = path.join(ROOT, "gpu-worker-test-sawblade.png");
  (server as unknown as { fetchSourceImage: (u: string) => Promise<Buffer> }).fetchSourceImage = async () =>
    readFileSync(sourcePath);

  const prep = await orch.prepare(job);
  console.log(`[${v.key}] positive:`, prep.positive);
  console.log(`[${v.key}] steps=${v.steps} cfg=${v.cfg} res=${prep.width}x${prep.height} frames=${prep.genFrameCount}`);

  const rawFrames = await orch.generate(prep);
  console.log(`[${v.key}] 원본 프레임 수:`, rawFrames.length);
  for (let i = 0; i < rawFrames.length; i++) {
    const png = await frameToPng(rawFrames[i]);
    writeFileSync(path.join(OUT_DIR, `raw-${String(i).padStart(2, "0")}.png`), png);
  }

  const sheet = await orch.finish(prep, rawFrames);
  writeFileSync(path.join(OUT_DIR, "sheet.png"), sheet.png);
  console.log(`[${v.key}] 완료 — 출력:`, OUT_DIR);
}

async function main() {
  const comfyUrl = process.env.COMFYUI_URL ?? "http://127.0.0.1:8188";
  const backend = new ComfyUIBackend({ baseUrl: comfyUrl });
  const server = new ServerClient("http://127.0.0.1:0", undefined);

  const health = await backend.healthCheck();
  console.log("[test] ComfyUI healthCheck:", health);
  if (!health.ok) {
    console.error("[test] ComfyUI 응답 없음 — 중단");
    process.exit(1);
  }

  for (const v of VARIANTS) {
    await runVariant(v, backend, server);
  }
  console.log("\n[test] 전체 완료 — gpu-worker-test-out-{C,D,E} 확인");
}

main().catch((e) => {
  console.error("[test] 실패:", e);
  process.exit(1);
});
