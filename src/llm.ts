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
      locationContext: {
        summary: assessment.locationContext.summary,
        housingSignalLevel: assessment.locationContext.housingSignalLevel,
        highRenterShare: assessment.locationContext.highRenterShare,
        largeHousingUnitBase: assessment.locationContext.largeHousingUnitBase,
        premiumRentMarket: assessment.locationContext.premiumRentMarket,
        housingSignalTags: assessment.locationContext.housingSignalTags,
        housingContextTags: assessment.locationContext.housingContextTags,
        renterOccupiedPct: assessment.locationContext.renterOccupiedPct,
        housingUnits: assessment.locationContext.housingUnits,
        medianGrossRent: assessment.locationContext.medianGrossRent
      },
      hasValidatedPropertyAddress: assessment.address.isValid && assessment.address.isComplete
    },
    scoring: {
      score: scoredLead.score,
      tier: scoredLead.tier,
      recommendedStatus: scoredLead.recommendedStatus,
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
    "When housing context is available, prefer renter share and housing-unit base over median gross rent. Treat median gross rent as supporting context only, not as proof of EliseAI fit.",
    "For uncertain leads, use cautious language like 'Possible fit only if...' rather than 'Likely fit...'.",
    "Draft outreach email must be plain text, short, and personalized without sounding generic.",
    "Vary outreach tone by tier and status.",
    "For HOT or ENRICHED strong-fit leads, write more directly: assume the account is relevant, reference the company/property context, and ask for a concrete conversation about renter inquiries, leasing follow-up, or resident communication volume.",
    "For WARM ENRICHED leads, sound confident but measured: cite the strongest signals and ask whether automation would help the team reduce manual leasing or resident communication work.",
    "For REVIEW leads, be conditional: ask whether the contact owns residential leasing or resident operations before making the EliseAI connection.",
    "For COLD or incomplete leads, be exploratory: ask for confirmation or routing and avoid a hard pitch.",
    "When supported by the enrichment, reference multifamily leasing teams and inbound renter inquiries.",
    "Avoid repeating the same phrasing across rows. Do not overuse words like 'workflows' or repeat 'resident-facing property operations' if simpler phrasing like 'resident operations', 'leasing teams', 'renter inquiries', or 'follow-up' would sound more natural.",
    "Do not start every email with an 'If you support...' sentence; reserve that structure for REVIEW or ambiguous leads.",
    "Only mention scale, portfolio breadth, or operator size when the company profile actually supports that claim.",
    "A strong-fit email can mention that multifamily leasing teams often handle high volumes of inbound renter inquiries and follow-up, and EliseAI helps onsite teams respond faster with less manual coordination.",
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
