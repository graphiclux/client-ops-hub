import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldRetryHttpStatus } from "@/lib/retry";

test("shouldRetryHttpStatus retries on 429 and 5xx", () => {
  assert.equal(shouldRetryHttpStatus(429), true);
  assert.equal(shouldRetryHttpStatus(500), true);
  assert.equal(shouldRetryHttpStatus(503), true);
});

test("shouldRetryHttpStatus does not retry on 4xx (except 429)", () => {
  assert.equal(shouldRetryHttpStatus(400), false);
  assert.equal(shouldRetryHttpStatus(401), false);
  assert.equal(shouldRetryHttpStatus(404), false);
});
