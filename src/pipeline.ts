import { STATUS } from "./constants.js";
import { buildLeadPreviewPayload, sendLeadPreview } from "./analytics.js";
import { generateRepOutputs } from "./llm.js";
import { createLeadLogger } from "./logger.js";
import { normalizeLead } from "./normalization.js";
import { buildAssessment } from "./providers.js";
import { buildActionabilityOutputs } from "./rep-output.js";
import { scoreLead } from "./scoring.js";
import {
  ensureLeadSheet,
  formatAddressValidationSummary,
  getLeadSheet,
  initializeRowStatusIfBlank,
  readLeadInput,
  writeRowOutput
} from "./sheets.js";
import type { LeadAssessment, LeadInput, NormalizedLead, RepOutputs, ScoredLead, SheetRowOutput } from "./types.js";
import { nowIsoString } from "./utils.js";

function buildSheetRowOutput(
  assessment: ReturnType<typeof buildAssessment>,
  score = scoreLead(assessment),
  repOutputs = generateRepOutputs(assessment, score)
): SheetRowOutput {
  const companyDomain = assessment.company.canonicalDomain;
  const companyWebsite = assessment.company.website || (companyDomain ? `https://${companyDomain}` : "");
  const actionability = buildActionabilityOutputs(assessment, score);
  const addressSummary = formatAddressValidationSummary(
    assessment.address.formattedAddress,
    assessment.address.isValid,
    assessment.address.confidence,
    assessment.address.matchType
  );

  return {
    "Company Domain": companyDomain,
    "Company Website": companyWebsite,
    "Enriched Company Info": repOutputs.enrichedCompanyInfo,
    "Address / Property Validation": addressSummary,
    "Lead Score": score.score,
    "Lead Tier": score.tier,
    "Lead Score Reason": score.scoreReason,
    "Sales Insights": repOutputs.salesInsights,
    "Why Prioritize": actionability.whyPrioritize,
    "What's Missing": actionability.whatsMissing,
    "Draft Outreach Email": repOutputs.draftOutreachEmail,
    Status: score.recommendedStatus,
    "Last Processed At": nowIsoString()
  };
}

export function processLeadRow(rowNumber: number): void {
  const logger = createLeadLogger({
    runId: `lead-row-${rowNumber}-${Date.now()}`,
    rowNumber
  });
  const lock = LockService.getDocumentLock();
  lock.waitLock(30_000);
  let input: LeadInput = {
    name: "",
    email: "",
    company: "",
    propertyAddress: "",
    city: "",
    state: "",
    country: ""
  };
  let normalized: NormalizedLead | null = null;
  let assessment: LeadAssessment | null = null;
  let scoredLead: ScoredLead | null = null;
  let repOutputs: RepOutputs | null = null;

  try {
    logger.info("lead.process.start");
    const sheet = getLeadSheet();
    const headerMap = ensureLeadSheet();
    input = readLeadInput(sheet, rowNumber, headerMap);
    const currentStatus = initializeRowStatusIfBlank(sheet, rowNumber, headerMap, input);
    logger.info("lead.process.row-loaded", {
      input,
      currentStatus
    });

    if (rowNumber === 1 || currentStatus !== STATUS.NEW) {
      logger.info("lead.process.skip", {
        reason: rowNumber === 1 ? "header-row" : "status-not-new",
        currentStatus
      });
      return;
    }

    logger.info("lead.process.status-pending", {
      status: STATUS.PENDING,
      mode: "internal-only"
    });

    normalized = normalizeLead(input);
    logger.info("lead.process.normalized", normalized);
    assessment = buildAssessment(normalized, logger);
    scoredLead = scoreLead(assessment, logger);
    repOutputs = generateRepOutputs(assessment, scoredLead, logger);
    const rowOutput = buildSheetRowOutput(assessment, scoredLead, repOutputs);
    logger.info("lead.process.output-prepared", {
      rowOutput,
      usedFallbackRepOutputs: repOutputs.usedFallback
    });

    writeRowOutput(sheet, rowNumber, headerMap, rowOutput);
    sendLeadPreview(
      buildLeadPreviewPayload({
        runId: logger.context.runId,
        leadRowNumber: rowNumber,
        processingStatus: rowOutput.Status,
        input,
        normalized,
        assessment,
        scoredLead,
        repOutputs,
        rowOutput
      }),
      logger
    );
    logger.info("lead.process.completed", {
      finalStatus: rowOutput.Status,
      score: rowOutput["Lead Score"],
      tier: rowOutput["Lead Tier"]
    });
  } catch (error) {
    const sheet = getLeadSheet();
    const headerMap = ensureLeadSheet();
    const message = error instanceof Error ? error.message : "Unknown processing error";
    logger.error("lead.process.error", {
      error
    });

    writeRowOutput(sheet, rowNumber, headerMap, {
      "Lead Score": 0,
      "Lead Tier": "COLD",
      "Lead Score Reason": `Processing failed: ${message}`,
      "Address / Property Validation": "Processing failed before address validation completed.",
      "Why Prioritize": "Do not prioritize until the row processes successfully.",
      "What's Missing": "A successful enrichment run and final scoring output.",
      Status: STATUS.ERROR,
      "Last Processed At": nowIsoString()
    });
    sendLeadPreview(
      buildLeadPreviewPayload({
        runId: logger.context.runId,
        leadRowNumber: rowNumber,
        processingStatus: STATUS.ERROR,
        errorMessage: message,
        input,
        normalized,
        assessment,
        scoredLead,
        repOutputs,
        rowOutput: {
          "Lead Score": 0,
          "Lead Tier": "COLD",
          "Lead Score Reason": `Processing failed: ${message}`,
          "Address / Property Validation": "Processing failed before address validation completed.",
          "Why Prioritize": "Do not prioritize until the row processes successfully.",
          "What's Missing": "A successful enrichment run and final scoring output.",
          Status: STATUS.ERROR,
          "Last Processed At": nowIsoString()
        }
      }),
      logger
    );
  } finally {
    lock.releaseLock();
  }
}

export function processNewLeadRows(): number {
  const sheet = getLeadSheet();
  const headerMap = ensureLeadSheet();
  const lastRow = sheet.getLastRow();
  let processed = 0;
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "INFO",
      event: "lead.batch.start",
      data: {
        lastRow
      }
    })
  );

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const input = readLeadInput(sheet, rowNumber, headerMap);
    const currentStatus = initializeRowStatusIfBlank(sheet, rowNumber, headerMap, input);
    if (currentStatus === STATUS.NEW) {
      processLeadRow(rowNumber);
      processed += 1;
    }
  }

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "INFO",
      event: "lead.batch.completed",
      data: {
        processed
      }
    })
  );
  return processed;
}
