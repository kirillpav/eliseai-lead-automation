import assert from "node:assert/strict";
import test from "node:test";

import { extractOpenAiUsage, extractOutputText, extractResponseId, parseJsonSafely } from "../shared/openai-responses.js";

test("extractOpenAiUsage reads cached token details and output text content", () => {
  const response = {
    id: "resp_123",
    output: [
      {
        content: [
          {
            type: "output_text",
            text: '{"draftOutreachEmail":"hi"}'
          }
        ]
      }
    ],
    usage: {
      input_tokens: 1200,
      output_tokens: 300,
      total_tokens: 1500,
      input_tokens_details: {
        cached_tokens: 200
      }
    }
  };

  assert.equal(extractResponseId(response), "resp_123");
  assert.equal(extractOutputText(response), '{"draftOutreachEmail":"hi"}');
  assert.deepEqual(extractOpenAiUsage(response), {
    inputTokens: 1200,
    cachedInputTokens: 200,
    outputTokens: 300,
    totalTokens: 1500
  });
});

test("parseJsonSafely returns null for invalid JSON", () => {
  assert.equal(parseJsonSafely("{not-json"), null);
});
