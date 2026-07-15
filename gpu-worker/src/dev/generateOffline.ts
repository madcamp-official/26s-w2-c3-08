// VPN/게이트웨이 없이 76개(배경 제외 71개) 스프라이트를 전부 생성한다.
// 외형은 asset-sources/appearance.mjs(Claude가 그림 보고 쓴 것)를 job.prompt로 주입 →
// Orchestrator.getAppearance가 게이트웨이 호출 없이 그대로 사용 → ComfyUI(로컬)만 있으면 됨.
// 결과 시트: gpu-worker-sprites/<assetId>/<action>.png (+ per-asset 미리보기 몽타주).
// 이미 있는 시트는 건너뜀 — 중간에 끊겨도 재실행하면 이어짐(resumable).
// DB 업로드는 안 함(요청: "스프라이트는 나중에 업데이트") — 로컬 파일로만 저장.
// 실행: npx tsx gpu-worker/src/dev/generateOffline.ts  (ComfyUI :8188 만 켜져 있으면 됨)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveActions, ACTIONS, type ActionName } from "shared/actions";
import { ComfyUIBackend } from "../backends/comfyui/client.js";
import { ServerClient, type JobPayload } from "../jobs/serverClient.js";
import { Orchestrator } from "../orchestrator/generateAsset.js";
import { ASSETS } from "../../../asset-sources/manifest.mjs";
import { APPEARANCE } from "../../../asset-sources/appearance.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
try { process.loadEnvFile(path.join(ROOT, "gpu-worker", ".env")); } catch {}

const OUT = path.join(ROOT, "gpu-worker-sprites");
mkdirSync(OUT, { recursive: true });

async function main() {
  const backend = new ComfyUIBackend({ baseUrl: process.env.COMFYUI_URL ?? "http://127.0.0.1:8188" });
  const server = new ServerClient("http://127.0.0.1:0", undefined);
  const health = await backend.healthCheck();
  console.log("[gen] ComfyUI:", health);
  if (!health.ok) { console.error("[gen] ComfyUI 없음 — 중단"); process.exit(1); }

  // ⚠️ gateway 미전달 — job.prompt(외형)를 직접 넣으므로 게이트웨이/VPN 불필요.
  const orch = new Orchestrator({ backend, server });

  const targets = ASSETS.filter((a) => a.category !== "background"); // 배경은 생성 안 함
  // idle 먼저(키높이 캐시 순서 보존) 정렬은 asset 단위론 무의미하지만, asset 내부 액션은 deriveActions가 idle 우선.
  let doneJobs = 0, skipJobs = 0, failJobs = 0;
  const t0 = Date.now();

  for (let ai = 0; ai < targets.length; ai++) {
    const asset = targets[ai];
    const appearance = APPEARANCE[asset.id];
    if (!appearance) { console.warn(`[gen] ⚠️ appearance 없음, 건너뜀: ${asset.id}`); continue; }

    const srcPath = path.join(ROOT, "asset-sources", asset.file);
    (server as unknown as { fetchSourceImage: (u: string) => Promise<Buffer> }).fetchSourceImage = async () =>
      readFileSync(srcPath);

    const assetDir = path.join(OUT, asset.id);
    mkdirSync(assetDir, { recursive: true });
    const actions = deriveActions(asset.category as never, asset.attrs as never);

    console.log(`\n[gen] (${ai + 1}/${targets.length}) ${asset.id} — 액션 ${actions.map((x) => x.name).join(",")}`);

    for (const derived of actions) {
      const action = derived.name as ActionName;
      const outPath = path.join(assetDir, `${action}.png`);
      if (existsSync(outPath)) { console.log(`  · ${action} 이미 있음, 스킵`); skipJobs++; continue; }

      const spec = ACTIONS[action];
      const job: JobPayload = {
        jobId: `${asset.id}-${action}`, assetId: asset.id, name: asset.name, action,
        sourceImageUrl: `local://${asset.id}`, sourceType: "drawn", normPending: false,
        category: asset.category as never, tilesW: asset.tiles.w, tilesH: asset.tiles.h,
        prompt: appearance, // ← 게이트웨이 대신 이걸 그대로 외형으로 씀
        motionHint: derived.motionHint, loop: spec.loop, returnsToStart: spec.returnsToStart,
        durationSec: spec.durationSec ?? null, poseHint: spec.poseHint ?? null,
        negativeExtra: spec.negativeExtra ?? [], skipLeadFrames: spec.skipLeadFrames ?? 0,
      };

      try {
        const ts = Date.now();
        const prep = await orch.prepare(job);
        const frames = await orch.generate(prep);
        const sheet = await orch.finish(prep, frames);
        writeFileSync(outPath, sheet.png);
        doneJobs++;
        const sec = ((Date.now() - ts) / 1000).toFixed(0);
        console.log(`  + ${action} 완료 (${sheet.frameCount}f ${sheet.frameW}x${sheet.frameH}, ${sec}s)`);
      } catch (e) {
        failJobs++;
        console.error(`  ✗ ${action} 실패: ${(e as Error).message}`);
      }
    }
  }

  const min = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n[gen] 전체 종료 — 생성 ${doneJobs} / 스킵 ${skipJobs} / 실패 ${failJobs} (${min}분). 결과: ${OUT}`);
}

main().catch((e) => { console.error("[gen] 치명적:", e); process.exit(1); });
