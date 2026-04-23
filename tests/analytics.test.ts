import assert from "node:assert/strict";
import test from "node:test";

import { buildGenerationIngestPayload } from "../src/analytics.js";

test("buildGenerationIngestPayload preserves success metadata", () => {
  const payload = buildGenerationIngestPayload({
    timestamp: "2026-04-23T18:45:00.000Z",
    runId: "lead-row-12-123",
    leadRowNumber: 12,
    model: "gpt-5.4-mini",
    prompt: "Summarize this lead.",
    outputText: '{"salesInsights":"fit • confidence • priority"}',
    requestPayload: {
      model: "gpt-5.4-mini"
    },
    responseBody: {
      id: "resp_123"
    },
    responseId: "resp_123",
    usage: {
      inputTokens: 900,
      cachedInputTokens: 100,
      outputTokens: 250,
      totalTokens: 1150
    },
    callStatus: "success"
  });

  assert.equal(payload.source, "apps-script");
  assert.equal(payload.runId, "lead-row-12-123");
  assert.equal(payload.leadRowNumber, 12);
  assert.equal(payload.responseId, "resp_123");
  assert.equal(payload.callStatus, "success");
  assert.deepEqual(payload.usage, {
    inputTokens: 900,
    cachedInputTokens: 100,
    outputTokens: 250,
    totalTokens: 1150
  });
});

test("buildGenerationIngestPayload captures failure records with empty response fields", () => {
  const payload = buildGenerationIngestPayload({
    runId: "lead-row-9-456",
    leadRowNumber: 9,
    model: "gpt-5.4-mini",
    prompt: "Summarize this lead.",
    outputText: "",
    requestPayload: {
      model: "gpt-5.4-mini"
    },
    responseBody: null,
    callStatus: "error",
    errorMessage: "Request failed with status 500"
  });

  assert.equal(payload.callStatus, "error");
  assert.equal(payload.errorMessage, "Request failed with status 500");
  assert.equal(payload.responseId, "");
  assert.equal(payload.usage, null);
});
