// 실측 스크립트 — 마리오 아바타 소스로 idle/walk/onair 3액션 전부 뽑아본다.
// 서버/DB 없이 오케스트레이터 직접 호출. idle을 먼저 돌려 기준 키높이를 캐시(다른 액션 크기 일관성).
// 실행: npx tsx gpu-worker/src/dev/testMarioSprites.ts  (레포 루트에서)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ACTIONS, fullMotionHint, type ActionName } from "shared/actions";
import { pipelineConfig } from "../config/index.js";
import { ComfyUIBackend } from "../backends/comfyui/client.js";
import { PromptGatewayClient } from "../llm/gatewayClient.js";
import { ClaudeVisionClient } from "../llm/claudeVisionClient.js";
import type { AppearanceRefiner } from "../llm/types.js";
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

  // 외형 서술 공급자: Claude API > 3090 Qwen 게이트웨이. 실측 스크립트이므로 스텁 폴백은 허용 안 함.
  const g = pipelineConfig.llmGateway;
  let gateway: AppearanceRefiner;
  let llmLabel: string;
  if (process.env.ANTHROPIC_API_KEY) {
    gateway = new ClaudeVisionClient({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.CLAUDE_VISION_MODEL,
      maxConcurrency: g.maxConcurrency,
      timeoutMs: g.timeoutMs,
    });
    llmLabel = `claude(${process.env.CLAUDE_VISION_MODEL ?? "claude-haiku-4-5"})`;
  } else if (process.env.QWEN_GATEWAY_URL) {
    gateway = new PromptGatewayClient({
      baseUrl: process.env.QWEN_GATEWAY_URL,
      internalToken: process.env.QWEN_INTERNAL_TOKEN ?? "",
      maxConcurrency: g.maxConcurrency,
      timeoutMs: g.timeoutMs,
      maxRetries: g.maxRetries,
      retryBaseDelayMs: g.retryBaseDelayMs,
    });
    llmLabel = "qwen-gateway";
  } else {
    console.error("[test] ANTHROPIC_API_KEY / QWEN_GATEWAY_URL 둘 다 미설정 — 실제 외형 서술 검증 스크립트인데 스텁으로 빠질 수 없음. 중단");
    process.exit(1);
  }
  console.log(`[test] 외형 서술 공급자: ${llmLabel}`);
  const orch = new Orchestrator({ backend, server, gateway }); // 실제 LLM이 이미지를 보고 외형을 서술(액션당 1회만 호출, 캐시 재사용)

  for (const action of ACTIONS_ORDER) {
    console.log(`\n===== 액션: ${action} =====`);
    const spec = ACTIONS[action];
    const job: JobPayload = {
      jobId: `test-mario-${action}`,
      assetId: "test-mario", // 액션 3개가 같은 assetId를 공유해야 외형·키높이 캐시가 재사용됨
      // ⚠️ 유명 캐릭터 이름을 job.name에 넣지 말 것(§2.5, §8) — 게이트웨이의 user_prompt로 그대로
      // 전달돼 Wan이 소스 그림 대신 학습된 얼굴을 소환할 위험이 있다. 무해한 라벨만 사용.
      name: "test avatar",
      action,
      sourceImageUrl: "local://mario",
      sourceType: "drawn",
      normPending: false,
      category: "avatar",
      tilesW: 1,
      tilesH: 2, // 아바타 고정 크기(player-spec.md)
      prompt: null, // null이어야 getAppearance()가 실제 게이트웨이를 탄다(백엔드 선채움 경로는 우회용).
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
