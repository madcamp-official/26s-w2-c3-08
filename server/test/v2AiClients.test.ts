import assert from "assert";

import {
  createQwenPromptClient,
  createWanRequestFromQwen,
  createWanSpriteClient,
} from "../src/ai/v2AiClients.js";
import { runAssetGenerationPipeline } from "../src/ai/v2AssetGenerationPipeline.js";

describe("frontend v2 ai clients", () => {
  it("fails explicitly when Qwen or WAN is not configured", async () => {
    const qwen = createQwenPromptClient({ baseUrl: "", apiToken: "" });
    const wan = createWanSpriteClient({ baseUrl: "", apiToken: "" });

    const qwenResult = await qwen.refinePrompt(createQwenRequest());
    const wanResult = await wan.generateSprite(createWanRequest());

    assert.equal(qwenResult.ok, false);
    assert.equal(qwenResult.ok === false && qwenResult.error.code, "QWEN_NOT_CONFIGURED");
    assert.equal(wanResult.ok, false);
    assert.equal(wanResult.ok === false && wanResult.error.code, "WAN_NOT_CONFIGURED");
  });

  it("sends the Qwen multipart request and validates the response", async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const qwen = createQwenPromptClient({
      baseUrl: "http://qwen.internal",
      apiToken: "qwen-token",
      fetcher: async (input, init) => {
        calls.push({ input, init });

        assert.equal(String(input), "http://qwen.internal/v1/prompts/refine");
        assert.equal((init?.headers as Record<string, string>)["X-Internal-Token"], "qwen-token");
        assert.equal(init?.body instanceof FormData, true);

        const formData = init?.body as FormData;

        assert.equal(formData.get("request_id"), "job-1");
        assert.equal(formData.get("target_type"), "asset");
        assert.equal(formData.get("style_preset"), "platformer_sprite");
        assert.equal(formData.get("image") instanceof Blob, true);

        return new Response(JSON.stringify({
          ok: true,
          request_id: "job-1",
          schema_version: "1.0",
          model: "qwen",
          engine: "gateway",
          target_type: "asset",
          visual_summary_ko: "초록 발판",
          user_intent_ko: "발판 생성",
          wan_prompt: "green platform sprite",
          wan_negative_prompt: "photorealistic",
          sprite_requirements: {
            background: "transparent",
            view: "side",
            framing: "full",
            style: "platformer",
            recommended_size: "512x512",
          },
          safety_flags: [],
          warnings: [],
          confidence: 0.9,
          latency_ms: 12,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    const result = await qwen.refinePrompt(createQwenRequest());

    assert.equal(calls.length, 1);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.wanPrompt, "green platform sprite");
    assert.equal(result.ok && result.value.background, "transparent");
  });

  it("rejects malformed Qwen success responses", async () => {
    const qwen = createQwenPromptClient({
      baseUrl: "http://qwen.internal",
      apiToken: "qwen-token",
      fetcher: async () =>
        new Response(JSON.stringify({
          ok: true,
          request_id: "job-1",
          wan_prompt: "",
          sprite_requirements: {},
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });

    const result = await qwen.refinePrompt(createQwenRequest());

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.error.code, "QWEN_MISSING_WAN_PROMPT");
  });

  it("maps Qwen and WAN HTTP failures without fake success", async () => {
    const qwen = createQwenPromptClient({
      baseUrl: "http://qwen.internal",
      apiToken: "qwen-token",
      fetcher: async () =>
        new Response(JSON.stringify({ error: { message: "too many requests" } }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
    });
    const wan = createWanSpriteClient({
      baseUrl: "http://wan.internal",
      apiToken: "wan-token",
      fetcher: async () =>
        new Response(JSON.stringify({ message: "wan down" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
    });

    const qwenResult = await qwen.refinePrompt(createQwenRequest());
    const wanResult = await wan.generateSprite(createWanRequest());

    assert.equal(qwenResult.ok, false);
    assert.equal(qwenResult.ok === false && qwenResult.error.code, "QWEN_HTTP_429");
    assert.equal(qwenResult.ok === false && qwenResult.error.retryable, true);
    assert.equal(wanResult.ok, false);
    assert.equal(wanResult.ok === false && wanResult.error.code, "WAN_HTTP_503");
    assert.equal(wanResult.ok === false && wanResult.error.retryable, true);
  });

  it("normalizes WAN JSON and image responses", async () => {
    const wanJson = createWanSpriteClient({
      baseUrl: "http://wan.internal",
      apiToken: "wan-token",
      fetcher: async (input, init) => {
        assert.equal(String(input), "http://wan.internal/v1/sprites/generate");
        assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer wan-token");

        return new Response(JSON.stringify({
          sheetUrl: "data:image/png;base64,abc",
          mimeType: "image/png",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    const wanImage = createWanSpriteClient({
      baseUrl: "http://wan.internal",
      apiToken: "wan-token",
      fetcher: async () =>
        new Response(Buffer.from("png"), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
    });

    const jsonResult = await wanJson.generateSprite(createWanRequest());
    const imageResult = await wanImage.generateSprite(createWanRequest());

    assert.equal(jsonResult.ok, true);
    assert.equal(jsonResult.ok && jsonResult.value.sheetUrl, "data:image/png;base64,abc");
    assert.equal(imageResult.ok, true);
    assert.match(imageResult.ok ? imageResult.value.sheetUrl : "", /^data:image\/png;base64,/);
  });

  it("builds a WAN request from a validated Qwen response", () => {
    const request = createQwenRequest();
    const wanRequest = createWanRequestFromQwen(request, {
      requestId: request.requestId,
      model: "qwen",
      engine: "gateway",
      targetType: "asset",
      visualSummaryKo: "요약",
      userIntentKo: "의도",
      wanPrompt: "sprite prompt",
      wanNegativePrompt: "bad things",
      background: "transparent",
      raw: {},
    });

    assert.equal(wanRequest.requestId, "job-1");
    assert.equal(wanRequest.prompt, "sprite prompt");
    assert.equal(wanRequest.negativePrompt, "bad things");
    assert.equal(wanRequest.referenceImage, request.image);
  });

  it("runs Qwen then WAN without converting failures into fake success", async () => {
    const qwenValue = {
      requestId: "job-1",
      model: "qwen",
      engine: "gateway",
      targetType: "asset" as const,
      visualSummaryKo: "요약",
      userIntentKo: "의도",
      wanPrompt: "sprite prompt",
      wanNegativePrompt: "bad things",
      background: "transparent",
      raw: {},
    };
    const successResult = await runAssetGenerationPipeline(createQwenRequest(), {
      qwen: {
        async refinePrompt() {
          return { ok: true as const, value: qwenValue };
        },
      },
      wan: {
        async generateSprite(request) {
          assert.equal(request.prompt, "sprite prompt");

          return {
            ok: true as const,
            value: {
              sheetUrl: "data:image/png;base64,generated",
              mimeType: "image/png",
              raw: {},
            },
          };
        },
      },
    });
    const failureResult = await runAssetGenerationPipeline(createQwenRequest(), {
      qwen: {
        async refinePrompt() {
          return { ok: true as const, value: qwenValue };
        },
      },
      wan: {
        async generateSprite() {
          return {
            ok: false as const,
            error: {
              code: "WAN_NOT_CONFIGURED",
              message: "WAN is not configured.",
              retryable: false,
            },
          };
        },
      },
    });

    assert.equal(successResult.ok, true);
    assert.equal(successResult.ok && successResult.value.sheetUrl, "data:image/png;base64,generated");
    assert.equal(failureResult.ok, false);
    assert.equal(failureResult.ok === false && failureResult.jobResult.status, "failed");
    assert.equal(failureResult.ok === false && failureResult.jobResult.errorCode, "WAN_NOT_CONFIGURED");
  });
});

function createQwenRequest() {
  return {
    requestId: "job-1",
    userId: "user-1",
    targetType: "asset" as const,
    userPrompt: "초록 발판",
    image: "data:image/png;base64,AA==",
    assetType: "platform",
  };
}

function createWanRequest() {
  return {
    requestId: "job-1",
    targetType: "asset" as const,
    prompt: "green platform sprite",
    negativePrompt: "photorealistic",
    referenceImage: "data:image/png;base64,AA==",
    width: 512,
    height: 512,
    background: "transparent",
  };
}
