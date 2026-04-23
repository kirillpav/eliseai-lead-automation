import assert from "node:assert/strict";
import test from "node:test";

import { computeGenerationCost, normalizeUsage } from "../shared/generation-analytics.js";

test("computeGenerationCost accounts for cached input pricing", () => {
  const result = computeGenerationCost(
    "gpt-5.4-mini",
    {
      inputTokens: 1000,
      cachedInputTokens: 400,
      outputTokens: 500,
      totalTokens: 1500
    },
    {
      "gpt-5.4-mini": {
        input: 0.25,
        cached_input: 0.025,
        output: 2
      }
    }
  );

  assert.deepEqual(result, {
    costUsd: 0.00116,
    pricingStatus: "priced"
  });
});

test("computeGenerationCost returns missing config or usage when incomplete", () => {
  assert.deepEqual(computeGenerationCost("gpt-5.4-mini", null, {}), {
    costUsd: null,
    pricingStatus: "missing_usage"
  });

  assert.deepEqual(
    computeGenerationCost(
      "gpt-5.4-mini",
      {
        inputTokens: 10,
        cachedInputTokens: 0,
        outputTokens: 5,
        totalTokens: 15
      },
      {}
    ),
    {
      costUsd: null,
      pricingStatus: "missing_config"
    }
  );
});

test("normalizeUsage infers total tokens when omitted", () => {
  assert.deepEqual(
    normalizeUsage({
      inputTokens: 22,
      outputTokens: 8
    }),
    {
      inputTokens: 22,
      cachedInputTokens: null,
      outputTokens: 8,
      totalTokens: 30
    }
  );
});
