import type { GenerationCallStatus, GenerationIngestPayload, OpenAiUsage } from "../shared/generation-analytics.js";
import type { LeadPreviewPayload } from "../shared/lead-preview.js";
import { getConfig } from "./config.js";
import { fetchJson } from "./http.js";
import type { LeadLogger } from "./logger.js";
import type { LeadAssessment, LeadInput, NormalizedLead, RepOutputs, ScoredLead, SheetRowOutput } from "./types.js";
import { nowIsoString } from "./utils.js";

interface BuildGenerationIngestPayloadInput {
  timestamp?: string;
  runId: string;
  leadRowNumber?: number | null;
  model: string;
  prompt: string;
  outputText: string;
  requestPayload: unknown;
  responseBody: unknown;
  responseId?: string;
  usage?: OpenAiUsage | null;
  callStatus: GenerationCallStatus;
  errorMessage?: string;
}

function analyticsEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/ingest/generation`;
}

function leadPreviewEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/ingest/lead`;
}

export function buildGenerationIngestPayload(input: BuildGenerationIngestPayloadInput): GenerationIngestPayload {
  return {
    timestamp: input.timestamp ?? nowIsoString(),
    source: "apps-script",
    runId: input.runId,
    leadRowNumber: input.leadRowNumber ?? null,
    model: input.model,
    prompt: input.prompt,
    outputText: input.outputText,
    requestPayload: input.requestPayload,
    responseBody: input.responseBody,
    responseId: input.responseId ?? "",
    usage: input.usage ?? null,
    callStatus: input.callStatus,
    errorMessage: input.errorMessage ?? ""
  };
}

export function sendGenerationAnalytics(payload: GenerationIngestPayload, logger?: LeadLogger): void {
  const config = getConfig();
  if (!config.analyticsBaseUrl || !config.analyticsIngestToken) {
    logger?.info("lead.analytics.skipped", {
      reason: "missing-config"
    });
    return;
  }

  const endpoint = analyticsEndpoint(config.analyticsBaseUrl);
  try {
    fetchJson<{ id: number }>(endpoint, {
      method: "post",
      headers: {
        Authorization: `Bearer ${config.analyticsIngestToken}`
      },
      payload
    });
    logger?.info("lead.analytics.sent", {
      endpoint,
      model: payload.model,
      callStatus: payload.callStatus
    });
  } catch (error) {
    logger?.warn("lead.analytics.failed", {
      endpoint,
      error
    });
  }
}

interface BuildLeadPreviewPayloadInput {
  timestamp?: string;
  runId: string;
  leadRowNumber: number;
  processingStatus: string;
  errorMessage?: string;
  input: LeadInput;
  normalized?: NormalizedLead | null;
  assessment?: LeadAssessment | null;
  scoredLead?: ScoredLead | null;
  repOutputs?: RepOutputs | null;
  rowOutput?: Partial<SheetRowOutput> | null;
}

export function buildLeadPreviewPayload(input: BuildLeadPreviewPayloadInput): LeadPreviewPayload {
  return {
    timestamp: input.timestamp ?? nowIsoString(),
    source: "apps-script",
    runId: input.runId,
    leadRowNumber: input.leadRowNumber,
    processingStatus: input.processingStatus,
    errorMessage: input.errorMessage ?? "",
    input: input.input,
    normalized: input.normalized ?? null,
    company: input.assessment?.company ?? null,
    address: input.assessment?.address ?? null,
    locationContext: input.assessment?.locationContext ?? null,
    scoredLead: input.scoredLead ?? null,
    repOutputs: input.repOutputs ?? null,
    rowOutput: input.rowOutput ?? null
  };
}

export function sendLeadPreview(payload: LeadPreviewPayload, logger?: LeadLogger): void {
  const config = getConfig();
  if (!config.analyticsBaseUrl || !config.analyticsIngestToken) {
    logger?.info("lead.preview.skipped", {
      reason: "missing-config"
    });
    return;
  }

  const endpoint = leadPreviewEndpoint(config.analyticsBaseUrl);
  try {
    fetchJson<{ id: number }>(endpoint, {
      method: "post",
      headers: {
        Authorization: `Bearer ${config.analyticsIngestToken}`
      },
      payload
    });
    logger?.info("lead.preview.sent", {
      endpoint,
      processingStatus: payload.processingStatus,
      leadRowNumber: payload.leadRowNumber
    });
  } catch (error) {
    logger?.warn("lead.preview.failed", {
      endpoint,
      error
    });
  }
}
