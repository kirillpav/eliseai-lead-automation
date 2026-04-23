import { STATUS } from "./constants.js";
import { generateRepOutputs } from "./llm.js";
import { createLeadLogger } from "./logger.js";
import { normalizeLead } from "./normalization.js";
import { buildAssessment } from "./providers.js";
import { scoreLead } from "./scoring.js";
import {
  ensureLeadSheet,
  formatAddressValidationSummary,
  getLeadSheet,
  initializeRowStatusIfBlank,
  readLeadInput,
  setRowStatus,
  writeRowOutput
} from "./sheets.js";
import type { LeadStatus, SheetRowOutput } from "./types.js";
import { nowIsoString } from "./utils.js";

function buildSheetRowOutput(
  assessment: ReturnType<typeof buildAssessment>,
  score = scoreLead(assessment),
  repOutputs = generateRepOutputs(assessment, score)
): SheetRowOutput {
  const companyDomain = assessment.company.canonicalDomain;
  const companyWebsite = assessment.company.website || (companyDomain ? `https://${companyDomain}` : "");
  const addressSummary = formatAddressValidationSummary(
    assessment.address.formattedAddress,
    assessment.address.isValid,
    assessment.address.confidence,
    assessment.address.matchType
  );

  const status: LeadStatus =
    score.recommendedStatus === STATUS.ENRICHED &&
    assessment.company.companyProfileFound &&
    assessment.address.isValid
      ? STATUS.ENRICHED
      : STATUS.NEEDS_REVIEW;

  return {
    "Company Domain": companyDomain,
    "Company Website": companyWebsite,
    "Enriched Company Info": repOutputs.enrichedCompanyInfo,
    "Address / Property Validation": addressSummary,
    "Lead Score": score.score,
    "Lead Score Reason": score.scoreReason,
    "Sales Insights": repOutputs.salesInsights,
    "Draft Outreach Email": repOutputs.draftOutreachEmail,
    Status: status,
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

  try {
    logger.info("lead.process.start");
    const sheet = getLeadSheet();
    const headerMap = ensureLeadSheet();
    const input = readLeadInput(sheet, rowNumber, headerMap);
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

    setRowStatus(sheet, rowNumber, headerMap, STATUS.PENDING);
    logger.info("lead.process.status-updated", {
      status: STATUS.PENDING
    });

    const normalized = normalizeLead(input);
    logger.info("lead.process.normalized", normalized);
    const assessment = buildAssessment(normalized, logger);
    const scoredLead = scoreLead(assessment, logger);
    const repOutputs = generateRepOutputs(assessment, scoredLead, logger);
    const rowOutput = buildSheetRowOutput(assessment, scoredLead, repOutputs);
    logger.info("lead.process.output-prepared", {
      rowOutput,
      usedFallbackRepOutputs: repOutputs.usedFallback
    });

    writeRowOutput(sheet, rowNumber, headerMap, rowOutput);
    logger.info("lead.process.completed", {
      finalStatus: rowOutput.Status,
      score: rowOutput["Lead Score"]
    });
  } catch (error) {
    const sheet = getLeadSheet();
    const headerMap = ensureLeadSheet();
    const message = error instanceof Error ? error.message : "Unknown processing error";
    logger.error("lead.process.error", {
      error
    });

    writeRowOutput(sheet, rowNumber, headerMap, {
      "Lead Score Reason": `Processing failed: ${message}`,
      "Address / Property Validation": "Processing failed before address validation completed.",
      Status: STATUS.ERROR,
      "Last Processed At": nowIsoString()
    });
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
