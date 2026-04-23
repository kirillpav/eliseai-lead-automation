export type GenerationSource = "apps-script";
export type GenerationCallStatus = "success" | "error";
export type PricingStatus = "priced" | "missing_config" | "missing_usage";

export interface OpenAiUsage {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface GenerationIngestPayload {
  timestamp: string;
  source: GenerationSource;
  runId: string;
  leadRowNumber: number | null;
  model: string;
  prompt: string;
  outputText: string;
  requestPayload: unknown;
  responseBody: unknown;
  responseId: string;
  usage: OpenAiUsage | null;
  callStatus: GenerationCallStatus;
  errorMessage: string;
}

export interface ModelPricing {
  input: number;
  output: number;
  cached_input?: number;
}

export type PricingConfig = Record<string, ModelPricing>;

export interface CostComputation {
  costUsd: number | null;
  pricingStatus: PricingStatus;
}

export interface GenerationFilters {
  start?: string;
  end?: string;
  model?: string;
  callStatus?: GenerationCallStatus | "";
  pricingStatus?: PricingStatus | "";
}

export interface GenerationCallRecord {
  id: number;
  createdAt: string;
  source: GenerationSource;
  runId: string;
  leadRowNumber: number | null;
  model: string;
  prompt: string;
  outputText: string;
  requestPayloadJson: string;
  responseJson: string;
  responseId: string;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  pricingStatus: PricingStatus;
  callStatus: GenerationCallStatus;
  errorMessage: string;
}

export interface ModelSpendSummary {
  model: string;
  calls: number;
  spendUsd: number;
}

export interface GenerationSummary {
  totalSpendUsd: number;
  totalCalls: number;
  averageCostUsd: number | null;
  pricedCalls: number;
  models: ModelSpendSummary[];
}

function toNonNegativeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

export function normalizeUsage(usage: Partial<OpenAiUsage> | null | undefined): OpenAiUsage | null {
  if (!usage) {
    return null;
  }

  const inputTokens = toNonNegativeNumber(usage.inputTokens);
  const cachedInputTokens = toNonNegativeNumber(usage.cachedInputTokens);
  const outputTokens = toNonNegativeNumber(usage.outputTokens);
  const inferredTotal =
    inputTokens !== null || outputTokens !== null ? (inputTokens ?? 0) + (outputTokens ?? 0) : null;
  const totalTokens = toNonNegativeNumber(usage.totalTokens) ?? inferredTotal;

  if (inputTokens === null && cachedInputTokens === null && outputTokens === null && totalTokens === null) {
    return null;
  }

  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens
  };
}

export function computeGenerationCost(model: string, usage: OpenAiUsage | null | undefined, pricing: PricingConfig): CostComputation {
  const normalizedUsage = normalizeUsage(usage);
  if (!normalizedUsage) {
    return {
      costUsd: null,
      pricingStatus: "missing_usage"
    };
  }

  const rates = pricing[model];
  if (!rates) {
    return {
      costUsd: null,
      pricingStatus: "missing_config"
    };
  }

  const inputTokens = normalizedUsage.inputTokens ?? 0;
  const cachedInputTokens = Math.min(normalizedUsage.cachedInputTokens ?? 0, inputTokens);
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const outputTokens = normalizedUsage.outputTokens ?? 0;
  const cachedInputRate = rates.cached_input ?? rates.input;
  const costPerMillion =
    uncachedInputTokens * rates.input + cachedInputTokens * cachedInputRate + outputTokens * rates.output;

  return {
    costUsd: Number((costPerMillion / 1_000_000).toFixed(8)),
    pricingStatus: "priced"
  };
}
