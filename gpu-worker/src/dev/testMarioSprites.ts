// 실측 스크립트 — 마리오 아바타 소스로 idle/walk/onair 3액션 전부 뽑아본다.
// 서버/DB 없이 오케스트레이터 직접 호출. idle을 먼저 돌려 기준 키높이를 캐시(다른 액션 크기 일관성).
// 실행: npx tsx gpu-worker/src/dev/testMarioSprites.ts  (레포 루트에서)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ACTIONS, fullMotionHint, type ActionName } from "shared/actions";
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

const OUT_DIR = path.join(ROOT, "gpu-worker-test-out-mario");
mkdirSync(OUT_DIR, { recursive: true });

const SOURCE_PATH = path.join(ROOT, "asset-prototype", "avatar-01-mario.png");
const ACTIONS_ORDER: ActionName[] = ["idle", "walk", "onair"]; // idle 먼저 — 키높이 캐시 순서

async function main() {
  const comfyUrl = process.env.COMFYUI_URL ?? "http://127.0.0.1:8188";
  const backend = new ComfyUIBackend({ baseUrl: comfyUrl });
  const server = new ServerClient("http://127.0.0.1:0", undefined);
  (server as unknown as { fetchSourceImage: (u: string) => Promise<Buffer> }).fetchSourceImage = async () =>
    readFileSync(SOURCE_PATH);

  const health = await backend.healthCheck();
  console.log("[test] ComfyUI healthCheck:", health);
  if (!health.ok) {
    console.error("[test] ComfyUI 응답 없음 — 중단");
    process.exit(1);
  }

  const orch = new Orchestrator({ backend, server }); // 게이트웨이 없음 = 스텁 외형(캐릭터 재사용, 액션당 1회만 호출됨)

  for (const action of ACTIONS_ORDER) {
    console.log(`\n===== 액션: ${action} =====`);
    const spec = ACTIONS[action];
    const job: JobPayload = {
      jobId: `test-mario-${action}`,
      assetId: "test-mario", // 액션 3개가 같은 assetId를 공유해야 외형·키높이 캐시가 재사용됨
      // ⚠️ "mario" 같은 유명 캐릭터 이름조차 스텁 외형에 그대로 들어가면 Wan이 소스 그림을 무시하고
      // 자기가 학습으로 기억하는 마리오 얼굴(눈 2개, 표정 등)을 그려버림(실측 확인 — 소스엔 눈 1개뿐인데
      // 결과엔 마리오 특유의 눈·표정이 나옴). 실제 게이트웨이(3090, VPN/SSH 필요)는 여기서 못 붙이므로,
      // 대신 이 이미지를 직접 보고 쓴 순수 외형 서술을 job.prompt에 넣는다(백엔드 선채움 경로 — 감싸지
      // 않고 그대로 wanPrompt로 사용됨. name은 캐주얼 라벨일 뿐이라 무해하게 둠).
      name: "test avatar",
      action,
      sourceImageUrl: "local://mario",
      sourceType: "drawn",
      normPending: false,
      category: "avatar",
      tilesW: 1,
      tilesH: 2, // 아바타 고정 크기(player-spec.md)
      // 실제 이미지(asset-prototype/avatar-01-mario.png)를 보고 직접 서술한 순수 외형(이름 언급 없음,
      // 포즈·뷰·배경 언급 없음 — qwen 시스템 프롬프트 규칙과 동일 기준). 실제 LLM 게이트웨이 대역.
      prompt:
        "a round-headed humanoid character with tan skin, wearing a red baseball-style cap with a small brim, " +
        "a bright red long-sleeved top, blue overall dungarees with two small gold buttons on the chest panel, " +
        "dark shoes, and a small brown mustache-like mark near the mouth; simple flat-colored cartoon " +
        "illustration style with thick rounded shapes and a hand-drawn wobbly outline, clean 2D platformer " +
        "game sprite, bold readable silhouette",
      motionHint: fullMotionHint(spec),
      loop: spec.loop,
      returnsToStart: spec.returnsToStart,
      durationSec: spec.durationSec ?? null,
      poseHint: spec.poseHint ?? null,
      negativeExtra: spec.negativeExtra ?? [],
      skipLeadFrames: spec.skipLeadFrames ?? 0,
    };

    const prep = await orch.prepare(job);
    console.log(`[${action}] positive:`, prep.positive);
    console.log(`[${action}] 생성 해상도: ${prep.width}x${prep.height}, 프레임수: ${prep.genFrameCount}`);

    const rawFrames = await orch.generate(prep);
    console.log(`[${action}] 원본 프레임 수:`, rawFrames.length);

    const actionDir = path.join(OUT_DIR, action);
    mkdirSync(actionDir, { recursive: true });
    for (let i = 0; i < rawFrames.length; i++) {
      writeFileSync(path.join(actionDir, `raw-${String(i).padStart(2, "0")}.png`), await frameToPng(rawFrames[i]));
    }

    const sheet = await orch.finish(prep, rawFrames);
    writeFileSync(path.join(actionDir, "sheet.png"), sheet.png);
    console.log(`[${action}] 완료 — ${sheet.frameCount}프레임 ${sheet.frameW}x${sheet.frameH}`);
  }

  console.log("\n[test] 전체 완료 —", OUT_DIR);
}

main().catch((e) => {
  console.error("[test] 실패:", e);
  process.exit(1);
});
