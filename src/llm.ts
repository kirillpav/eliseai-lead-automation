import { extractOpenAiUsage, extractOutputText, extractResponseId, parseJsonSafely } from "../shared/openai-responses.js";
import { buildGenerationIngestPayload, sendGenerationAnalytics } from "./analytics.js";
import { OPENAI_RESPONSE_SCHEMA } from "./constants.js";
import { fetchJsonWithMeta, HttpError } from "./http.js";
import type { LeadAssessment, RepOutputs, ScoredLead } from "./types.js";
import { getConfig } from "./config.js";
import type { LeadLogger } from "./logger.js";
import { buildFallbackRepOutputs } from "./rep-output.js";
import { formatInlineInsights, truncate } from "./utils.js";

interface OpenAiResponsesResponse {
  id?: string;
  output_text?: string;
  output?: unknown[];
  usage?: Record<string, unknown>;
}

function buildPrompt(assessment: LeadAssessment, scoredLead: ScoredLead): string {
  const context = {
    lead: {
      name: assessment.normalized.name,
      email: assessment.normalized.email,
      company: assessment.normalized.company,
      propertyAddress: assessment.address.formattedAddress || assessment.normalized.fullAddress
    },
    enrichment: {
      domain: assessment.company.canonicalDomain,
      website: assessment.company.website,
      companyDescription: assessment.company.description,
      businessType: assessment.company.businessType,
      industries: assessment.company.industries,
      employeeBand: assessment.company.employeeBand,
      foundedYear: assessment.company.foundedYear,
      headquarters: assessment.company.headquarters,
      corroboratedIdentity: assessment.company.corroboratedIdentity,
      addressConfidence: assessment.address.confidence,
      locationContext: assessment.locationContext.summary,
      hasValidatedPropertyAddress: assessment.address.isValid && assessment.address.isComplete
    },
    scoring: {
      score: scoredLead.score,
      fitLabel: scoredLead.fitLabel,
      positives: scoredLead.positiveSignals.slice(0, 3),
      negatives: scoredLead.negativeSignals.slice(0, 2),
      reason: scoredLead.scoreReason
    }
  };

  return [
    "You generate SDR-ready lead summaries for EliseAI.",
    "EliseAI sells into multifamily, residential property management, leasing, and housing operations.",
    "Keep outputs concise, practical, business-focused, and realistically critical.",
    "Do not mention that data came from APIs.",
    "Enriched company info must read like an enrichment summary, not a pitch.",
    "If fit is uncertain, say so directly instead of sounding optimistic.",
    "Do not use soft-pitch language such as 'worth checking' or 'could be interesting'.",
    "When the company looks like a broad real estate or commercial real estate services firm, make the uncertainty explicit: relevance depends on whether the contact actually supports residential leasing or resident-facing property operations.",
    "Sales insights must be a single line with exactly three clauses joined by ' • '.",
    "Do not use labels like Fit:, Confidence:, or Prioritize now:, and do not use markdown bullets, pipes, or numbering.",
    "The three clauses should cover: fit assessment, confidence in the lead data, and why to prioritize or deprioritize now.",
    "For uncertain leads, use cautious language like 'Possible fit only if...' rather than 'Likely fit...'.",
    "Draft outreach email must be plain text, short, and personalized without sounding generic.",
    "For uncertain or conditional-fit leads, open with the concrete company and property context you found, then condition the message on whether the contact actually supports residential leasing or resident-facing property operations there.",
    "For example: 'I found Company X tied to Address Y. If your team supports residential leasing or resident-facing property operations there, EliseAI helps automate inbound leasing and resident communication workflows.'",
    "When supported by the enrichment, explicitly reference multifamily leasing teams and inbound renter inquiries.",
    "Avoid repeating the same phrasing across rows. Do not overuse words like 'workflows' or repeat 'resident-facing property operations' if simpler phrasing like 'resident operations', 'leasing teams', 'renter inquiries', or 'follow-up' would sound more natural.",
    "For strong multifamily leads, a good pattern is: 'I came across Company X associated with Address Y. If you support leasing or resident operations there, EliseAI helps multifamily teams automate renter inquiries and follow-up so onsite staff can respond faster and spend less time on manual coordination.'",
    "Only mention scale, portfolio breadth, or operator size when the company profile actually supports that claim.",
    "A good email should sound like: teams managing multifamily leasing often handle high volumes of inbound renter inquiries and follow-up, and EliseAI helps automate leasing and resident communication workflows.",
    "",
    JSON.stringify(context, null, 2)
  ].join("\n");
}

export function generateRepOutputs(assessment: LeadAssessment, scoredLead: ScoredLead, logger?: LeadLogger): RepOutputs {
  const config = getConfig();
  if (!config.openAiApiKey) {
    logger?.warn("lead.llm.skipped", {
      reason: "missing-openai-api-key"
    });
    return buildFallbackRepOutputs(assessment, scoredLead);
  }

  const prompt = buildPrompt(assessment, scoredLead);
  const requestPayload = {
    model: config.openAiModel,
    input: [
      {
        role: "system",
        content: "Return only valid JSON matching the supplied schema."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "lead_rep_outputs",
        strict: true,
        schema: OPENAI_RESPONSE_SCHEMA
      }
    }
  };

  try {
    logger?.info("lead.llm.start", {
      model: config.openAiModel,
      company: assessment.normalized.company,
      score: scoredLead.score
    });
    const response = fetchJsonWithMeta<OpenAiResponsesResponse>("https://api.openai.com/v1/responses", {
      method: "post",
      headers: {
        Authorization: `Bearer ${config.openAiApiKey}`
      },
      payload: requestPayload
    });

    const responseBody: unknown = response.data;
    const outputText = extractOutputText(responseBody);
    const responseId = extractResponseId(responseBody);
    const usage = extractOpenAiUsage(responseBody);
    const parsed = JSON.parse(outputText) as RepOutputs;

    const result = {
      enrichedCompanyInfo: truncate(parsed.enrichedCompanyInfo, 420),
      salesInsights: truncate(formatInlineInsights(parsed.salesInsights), 520),
      draftOutreachEmail: truncate(parsed.draftOutreachEmail, 700),
      usedFallback: false
    };
    if (logger?.context) {
      sendGenerationAnalytics(
        buildGenerationIngestPayload({
          runId: logger.context.runId,
          leadRowNumber: logger.context.rowNumber,
          model: config.openAiModel,
          prompt,
          outputText,
          requestPayload,
          responseBody,
          responseId,
          usage,
          callStatus: "success"
        }),
        logger
      );
    }
    logger?.info("lead.llm.success", {
      usedFallback: result.usedFallback,
      enrichedCompanyInfo: result.enrichedCompanyInfo,
      salesInsights: result.salesInsights
    });
    return result;
  } catch (_error) {
    const responseBody =
      _error instanceof HttpError ? parseJsonSafely(_error.responseText) ?? { rawText: _error.responseText } : null;
    const outputText = extractOutputText(responseBody);
    const usage = extractOpenAiUsage(responseBody);
    const responseId = extractResponseId(responseBody);
    if (logger?.context) {
      sendGenerationAnalytics(
        buildGenerationIngestPayload({
          runId: logger.context.runId,
          leadRowNumber: logger.context.rowNumber,
          model: config.openAiModel,
          prompt,
          outputText,
          requestPayload,
          responseBody,
          responseId,
          usage,
          callStatus: "error",
          errorMessage: _error instanceof Error ? _error.message : "Unknown OpenAI error"
        }),
        logger
      );
    }
    logger?.warn("lead.llm.fallback", {
      reason: "openai-error",
      error: _error
    });
    return buildFallbackRepOutputs(assessment, scoredLead);
  }
}
