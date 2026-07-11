import assert from "node:assert";

import { QwenClient } from "../src/qwen/qwenClient.js";
import { QwenClientError } from "../src/qwen/qwenErrors.js";
import { qwenModelSchema } from "../src/qwen/qwenSchemas.js";

describe("Qwen model readiness", () => {
  it("parses degraded model responses so they can be handled as readiness errors", () => {
    const parsed = qwenModelSchema.parse({
      ok: false,
      model_id: "qwen2-vl-7b-instruct",
      engine: "vllm",
      vllm_ok: false,
      model_loaded: false,
      vllm_error_code: "VLLM_UNAVAILABLE"
    });

    assert.strictEqual(parsed.ok, false);
    assert.strictEqual(parsed.vllm_error_code, "VLLM_UNAVAILABLE");
  });

  it("maps degraded HTTP 200 model responses to pending-retry client errors", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
      ok: false,
      model_id: "qwen2-vl-7b-instruct",
      engine: "vllm",
      vllm_ok: false,
      model_loaded: false,
      vllm_error_code: "VLLM_UNAVAILABLE"
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });

    try {
      const client = new QwenClient({
        baseUrl: "http://127.0.0.1:8001",
        apiToken: "unit-test-token",
        timeoutMs: 1000
      });

      await assert.rejects(
        () => client.model(),
        (error: unknown) => {
          assert.ok(error instanceof QwenClientError);
          assert.strictEqual(error.status, 503);
          assert.strictEqual(error.code, "VLLM_UNAVAILABLE");
          assert.strictEqual(error.retryPolicy.action, "pending_retry");
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
