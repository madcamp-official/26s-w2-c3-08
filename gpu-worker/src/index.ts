// GPU 워커 — 5080(집) 상주. 백엔드 큐를 pull해 스프라이트를 생성한다 (NAT 안전: 전부 아웃바운드).
//   1) GET  {SERVER_URL}/api/ai/jobs/next     일감 claim
//   2) prepare: 소스 다운로드 → Stage1 정규화(업로드 배경분리) → LLM → 프롬프트/합성
//   3) generate: 로컬 ComfyUI I2V (GPU — 유일한 직렬 병목)
//   4) finish: Stage5 후처리 → 시트 → POST {SERVER_URL}/api/ai/jobs/{id}/result (실패 시 /fail)
//
// 병렬화(100유저 전제): GPU는 VRAM상 한 번에 1건이므로, 처리량을 올리는 방법은 GPU 생성 시간에
// 다른 잡의 CPU/네트워크 작업을 숨기는 것뿐이다.
//   - 현재 잡이 generate(GPU)하는 동안 → 다음 잡을 claim+prepare (프리페치 깊이 1)
//   - finish(CPU 후처리+업로드)는 직렬 체인으로 GPU와 병행 (idle 키높이 캐시 순서 보존)
//   프리페치를 1로 제한하는 이유: 서버가 claim 후 일정 시간(STALE_MS) 지나면 죽은 워커로 보고
//   재큐하므로, 미리 잡아두는 잡은 "현재 생성 1건이 끝날 때까지"만 대기하게 묶는다.
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
import { ClaudeVisionClient } from "./llm/claudeVisionClient.js";
import type { AppearanceRefiner } from "./llm/types.js";
import { ServerClient, type JobPayload } from "./jobs/serverClient.js";
import { Orchestrator, type PreparedJob } from "./orchestrator/generateAsset.js";

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

  // 외형 서술 공급자 우선순위: Claude API > 3090 Qwen 게이트웨이 > 스텁.
  // (Qwen2-VL-7B가 IP 규칙 무시 + 환각 디테일을 뽑는 것을 실측 확인해 Claude를 상위로 둠 — 2026-07-16)
  let gateway: AppearanceRefiner | undefined;
  let llmLabel = "STUB";
  if (process.env.ANTHROPIC_API_KEY) {
    const g = pipelineConfig.llmGateway;
    gateway = new ClaudeVisionClient({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.CLAUDE_VISION_MODEL,
      maxConcurrency: g.maxConcurrency,
      timeoutMs: g.timeoutMs,
    });
    llmLabel = `claude(${process.env.CLAUDE_VISION_MODEL ?? "claude-haiku-4-5"})`;
  } else if (process.env.QWEN_GATEWAY_URL) {
    const g = pipelineConfig.llmGateway;
    gateway = new PromptGatewayClient({
      baseUrl: process.env.QWEN_GATEWAY_URL,
      internalToken: process.env.QWEN_INTERNAL_TOKEN ?? "",
      maxConcurrency: g.maxConcurrency,
      timeoutMs: g.timeoutMs,
      maxRetries: g.maxRetries,
      retryBaseDelayMs: g.retryBaseDelayMs,
    });
    llmLabel = "qwen-gateway";
  }

  const orch = new Orchestrator({ backend, server, gateway });

  console.log(`[worker] 시작 — server=${serverUrl} comfyui=${comfyUrl} llm=${llmLabel}`);
  const health = await backend.healthCheck();
  if (!health.ok) {
    console.error(`[worker] ComfyUI 헬스체크 실패: ${health.detail} — ${comfyUrl} 확인. 계속 폴링합니다.`);
  }

  /** claim + prepare. 실패는 잡 fail 보고 후 null (루프는 계속). */
  async function claimAndPrepare(): Promise<PreparedJob | null> {
    let job: JobPayload | null = null;
    try {
      job = await server.claimNext();
    } catch (e) {
      console.error(`[worker] claim 오류: ${errMsg(e)}`);
      return null;
    }
    if (!job) return null;
    console.log(`[worker] 잡 ${job.jobId} (${job.category}/${job.action}) 준비 시작`);
    try {
      return await orch.prepare(job);
    } catch (e) {
      const msg = errMsg(e);
      console.error(`[worker] 잡 ${job.jobId} 준비 실패: ${msg}`);
      await server.postFail(job.jobId, msg).catch((e2) => {
        console.error(`[worker] fail 보고도 실패: ${errMsg(e2)}`);
      });
      return null;
    }
  }

  /** finish + 업로드. 직렬 체인(finishChain)에서 실행되어 잡 순서를 보존한다. */
  async function finishAndReport(prep: PreparedJob, frames: Awaited<ReturnType<typeof orch.generate>>): Promise<void> {
    const jobId = prep.job.jobId;
    try {
      const sheet = await orch.finish(prep, frames);
      await server.postResult(jobId, sheet.png, {
        frameCount: sheet.frameCount, frameW: sheet.frameW, frameH: sheet.frameH,
      });
      console.log(`[worker] 잡 ${jobId} 완료 (${sheet.frameCount}프레임 ${sheet.frameW}x${sheet.frameH})`);
    } catch (e) {
      const msg = errMsg(e);
      console.error(`[worker] 잡 ${jobId} 후처리/업로드 실패: ${msg}`);
      await server.postFail(jobId, msg).catch((e2) => {
        console.error(`[worker] fail 보고도 실패: ${errMsg(e2)}`);
      });
    }
  }

  // ── 메인 루프: [prepare(다음)] ∥ [generate(현재)] ∥ [finish(이전, 직렬 체인)] ──
  let prepared: PreparedJob | null = null;
  let finishChain: Promise<void> = Promise.resolve();

  for (;;) {
    const current = prepared ?? (await claimAndPrepare());
    prepared = null;
    if (!current) {
      await sleep(pollMs);
      continue;
    }

    // GPU 생성과 병행해 다음 잡을 미리 준비 (프리페치 깊이 1).
    const nextPromise = claimAndPrepare();

    try {
      const frames = await orch.generate(current);
      // finish는 체인에 넣고 바로 다음 생성으로 — CPU 후처리가 GPU를 막지 않는다.
      finishChain = finishChain.then(() => finishAndReport(current, frames));
    } catch (e) {
      const msg = errMsg(e);
      console.error(`[worker] 잡 ${current.job.jobId} 생성 실패: ${msg}`);
      await server.postFail(current.job.jobId, msg).catch((e2) => {
        console.error(`[worker] fail 보고도 실패: ${errMsg(e2)}`);
      });
    }

    prepared = await nextPromise;
    if (!prepared) {
      // 큐가 비었으면 밀린 finish를 마저 흘려보내고 짧게 대기.
      await finishChain;
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
