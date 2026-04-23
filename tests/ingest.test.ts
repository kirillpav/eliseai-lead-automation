import assert from "node:assert/strict";
import test from "node:test";

import { prepareGenerationCallForInsert, validateGenerationIngestPayload } from "../web/lib/ingest.js";
import { parsePricingConfig } from "../web/lib/pricing.js";

test("validateGenerationIngestPayload accepts a well-formed request body", () => {
  const result = validateGenerationIngestPayload({
    timestamp: "2026-04-23T18:30:00.000Z",
    source: "apps-script",
    runId: "run-123",
    leadRowNumber: 4,
    model: "gpt-5.4-mini",
    prompt: "Summarize this lead.",
    outputText: "Lead looks strong.",
    requestPayload: {
      model: "gpt-5.4-mini"
    },
    responseBody: {
      id: "resp_321"
    },
    responseId: "resp_321",
    usage: {
      inputTokens: 1000,
      cachedInputTokens: 250,
      outputTokens: 400,
      totalTokens: 1400
    },
    callStatus: "success",
    errorMessage: ""
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.source, "apps-script");
  assert.equal(result.value.model, "gpt-5.4-mini");
  assert.equal(result.value.leadRowNumber, 4);
});

test("prepareGenerationCallForInsert stores missing usage and missing pricing states", () => {
  const payloadResult = validateGenerationIngestPayload({
    timestamp: "2026-04-23T18:30:00.000Z",
    source: "apps-script",
    runId: "run-456",
    leadRowNumber: 7,
    model: "gpt-5.4-mini",
    prompt: "Summarize this lead.",
    outputText: "",
    requestPayload: {},
    responseBody: {
      error: "upstream failure"
    },
    responseId: "",
    usage: null,
    callStatus: "error",
    errorMessage: "upstream failure"
  });

  assert.equal(payloadResult.ok, true);
  if (!payloadResult.ok) {
    return;
  }

  const missingUsageRecord = prepareGenerationCallForInsert(payloadResult.value, {});
  assert.equal(missingUsageRecord.costUsd, null);
  assert.equal(missingUsageRecord.pricingStatus, "missing_usage");

  const pricedRecord = prepareGenerationCallForInsert(payloadResult.value, {
    "gpt-5.4-mini": {
      input: 0.25,
      output: 2
    }
  });
  assert.equal(pricedRecord.pricingStatus, "missing_usage");
});

test("parsePricingConfig validates pricing JSON", () => {
  assert.deepEqual(parsePricingConfig('{"gpt-5.4-mini":{"input":0.25,"cached_input":0.025,"output":2}}'), {
    "gpt-5.4-mini": {
      input: 0.25,
      cached_input: 0.025,
      output: 2
    }
  });

  assert.throws(() => parsePricingConfig('{"gpt-5.4-mini":{"input":"bad","output":2}}'), /invalid pricing/i);
});
