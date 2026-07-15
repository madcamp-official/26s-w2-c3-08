// prompts.py 3090 배포 확인용 — ComfyUI 없이 게이트웨이 /v1/prompts/refine만 직접 호출.
// 실행: npx tsx gpu-worker/src/dev/testGatewayOnly.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PromptGatewayClient } from "../llm/gatewayClient.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
try {
  process.loadEnvFile(path.join(ROOT, "gpu-worker", ".env"));
} catch {
  /* .env 없으면 셸 env */
}

async function main() {
  const gateway = new PromptGatewayClient({
    baseUrl: process.env.QWEN_GATEWAY_URL!,
    internalToken: process.env.QWEN_INTERNAL_TOKEN ?? "",
    maxConcurrency: 1,
    timeoutMs: 60_000,
  });

  const image = readFileSync(path.join(ROOT, "asset-prototype", "avatar-01-mario.png"));
  const result = await gateway.refine({
    requestId: "test-minimal-prompt",
    userId: "gpu-worker",
    targetType: "avatar",
    userPrompt: "test avatar",
    image,
  });

  if (!result.ok) {
    console.error("실패:", result.error);
    process.exit(1);
  }
  console.log("wan_prompt:", JSON.stringify(result.wan_prompt));
  console.log("길이:", result.wan_prompt.length, "자");
  console.log("wan_negative_prompt:", JSON.stringify(result.wan_negative_prompt));
  console.log("confidence:", result.confidence);
}

main().catch((e) => {
  console.error("실패:", e);
  process.exit(1);
});
