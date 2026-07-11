import assert from "node:assert";

import { getQwenRetryPolicy } from "../src/qwen/qwenErrors.js";

describe("Qwen retry policy", () => {
  it("fails terminal client/configuration statuses without retry", () => {
    for (const status of [400, 401, 413]) {
      const policy = getQwenRetryPolicy(status);
      assert.strictEqual(policy.action, "fail");
      assert.strictEqual(policy.retryable, false);
      assert.strictEqual(policy.maxAttempts, 1);
    }
  });

  it("allows exactly one immediate retry for model output and server errors", () => {
    for (const status of [422, 500]) {
      const policy = getQwenRetryPolicy(status);
      assert.strictEqual(policy.action, "retry");
      assert.strictEqual(policy.retryable, true);
      assert.strictEqual(policy.maxAttempts, 2);
    }
  });

  it("marks rate limits and unavailable model statuses as pending retry", () => {
    const rateLimited = getQwenRetryPolicy(429);
    assert.strictEqual(rateLimited.action, "pending_retry");
    assert.strictEqual(rateLimited.retryAfterMs, 5000);

    const unavailable = getQwenRetryPolicy(503);
    assert.strictEqual(unavailable.action, "pending_retry");
    assert.strictEqual(unavailable.retryable, true);
  });
});
