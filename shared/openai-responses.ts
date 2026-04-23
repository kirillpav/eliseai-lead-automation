import { normalizeUsage, type OpenAiUsage } from "./generation-analytics.js";

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toNumberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function extractOutputText(response: unknown): string {
  const record = toRecord(response);
  if (!record) {
    return "";
  }

  const directOutput = toStringValue(record.output_text);
  if (directOutput) {
    return directOutput;
  }

  const output = Array.isArray(record.output) ? record.output : [];
  return output
    .map((item) => toRecord(item))
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .map((contentItem) => toRecord(contentItem))
    .filter((item): item is Record<string, unknown> => item !== null && item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text as string)
    .join("");
}

export function extractResponseId(response: unknown): string {
  return toStringValue(toRecord(response)?.id);
}

export function extractOpenAiUsage(response: unknown): OpenAiUsage | null {
  const usage = toRecord(toRecord(response)?.usage);
  if (!usage) {
    return null;
  }

  const inputDetails = toRecord(usage.input_tokens_details);
  return normalizeUsage({
    inputTokens: toNumberValue(usage.input_tokens),
    cachedInputTokens: toNumberValue(usage.cached_input_tokens) ?? toNumberValue(inputDetails?.cached_tokens),
    outputTokens: toNumberValue(usage.output_tokens),
    totalTokens: toNumberValue(usage.total_tokens)
  });
}

export function parseJsonSafely(text: string): unknown | null {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
