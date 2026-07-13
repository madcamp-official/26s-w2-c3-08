// GPU 워커 — 5080(집) 상주. 백엔드 큐를 pull해 스프라이트를 생성한다 (NAT 안전: 전부 아웃바운드).
//   1) GET  {SERVER_URL}/api/ai/jobs/next     일감 claim
//   2) 원본 그림 다운로드 → 오케스트레이터(LLM→ComfyUI→Stage5→시트)
//   3) POST {SERVER_URL}/api/ai/jobs/{id}/result   시트 업로드 (실패 시 /fail)
//
// 환경변수:
//   SERVER_URL          백엔드 베이스 (예: https://sunboy7594.madcamp-kaist.org) [필수]
//   WORKER_TOKEN        pull 인증 토큰 (백엔드 WORKER_TOKEN과 일치; 미설정 시 개발용 통과)
//   COMFYUI_URL         로컬 ComfyUI (기본 http://127.0.0.1:8188)
//   QWEN_GATEWAY_URL    3090 게이트웨이 (미설정 시 외형 스텁 — 3090 없이 ComfyUI 검증)
//   QWEN_INTERNAL_TOKEN 게이트웨이 X-Internal-Token
//   POLL_INTERVAL_MS    큐 빔 시 대기(기본 3000)
import { fileURLToPath } from "node:url";

// gpu-worker/.env가 있으면 자동 로드 (Node 20.12+ 내장, 무의존). 없으면 셸 env 사용.
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch {
  /* .env 없음 — 셸 환경변수로 진행 */
}

import { pipelineConfig } from "./config/index.js";
import { ComfyUIBackend } from "./backends/comfyui/client.js";
import { PromptGatewayClient } from "./llm/gatewayClient.js";
import { ServerClient } from "./jobs/serverClient.js";
import { Orchestrator } from "./orchestrator/generateAsset.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[worker] 필수 환경변수 ${name} 미설정 — 종료`);
    process.exit(1);
  }
  return v;
}

async function main(): Promise<void> {
  const serverUrl = requireEnv("SERVER_URL");
  const workerToken = process.env.WORKER_TOKEN;
  const comfyUrl = process.env.COMFYUI_URL ?? "http://127.0.0.1:8188";
  const pollMs = Number(process.env.POLL_INTERVAL_MS ?? 3000);

  const server = new ServerClient(serverUrl, workerToken);
  const backend = new ComfyUIBackend({ baseUrl: comfyUrl });

  let gateway: PromptGatewayClient | undefined;
  if (process.env.QWEN_GATEWAY_URL) {
    const g = pipelineConfig.llmGateway;
    gateway = new PromptGatewayClient({
      baseUrl: process.env.QWEN_GATEWAY_URL,
      internalToken: process.env.QWEN_INTERNAL_TOKEN ?? "",
      maxConcurrency: g.maxConcurrency,
      timeoutMs: g.timeoutMs,
      maxRetries: g.maxRetries,
      retryBaseDelayMs: g.retryBaseDelayMs,
    });
  }

  const orch = new Orchestrator({ backend, gateway });

  console.log(`[worker] 시작 — server=${serverUrl} comfyui=${comfyUrl} llm=${gateway ? "gateway" : "STUB"}`);
  const health = await backend.healthCheck();
  if (!health.ok) {
    console.error(`[worker] ComfyUI 헬스체크 실패: ${health.detail} — ${comfyUrl} 확인. 계속 폴링합니다.`);
  }

  // 폴링 루프 — 잡 있으면 즉시 다음 폴링(연속 소진), 없으면 pollMs 대기.
  for (;;) {
    let job = null;
    try {
      job = await server.claimNext();
    } catch (e) {
      console.error(`[worker] claim 오류: ${errMsg(e)} — ${pollMs}ms 후 재시도`);
      await sleep(pollMs);
      continue;
    }
    if (!job) {
      await sleep(pollMs);
      continue;
    }

    console.log(`[worker] 잡 ${job.jobId} (${job.category}/${job.action}) 처리 시작`);
    try {
      const sourcePng = await server.fetchSourceImage(job.sourceImageUrl);
      const sheet = await orch.run(job, sourcePng);
      await server.postResult(job.jobId, sheet.png, {
        frameCount: sheet.frameCount, frameW: sheet.frameW, frameH: sheet.frameH,
      });
      console.log(`[worker] 잡 ${job.jobId} 완료 (${sheet.frameCount}프레임 ${sheet.frameW}x${sheet.frameH})`);
    } catch (e) {
      const msg = errMsg(e);
      console.error(`[worker] 잡 ${job.jobId} 실패: ${msg}`);
      try {
        await server.postFail(job.jobId, msg);
      } catch (e2) {
        console.error(`[worker] fail 보고도 실패: ${errMsg(e2)}`);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

main().catch((e) => {
  console.error("[worker] 치명적 오류:", e);
  process.exit(1);
});
