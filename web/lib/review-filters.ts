import type { Lead } from "./lead-mapper";

export type ReviewReason = "needs_review" | "low_score" | "missing_company_identity" | "low_address_confidence";

export interface ReviewSignal {
  reason: ReviewReason;
  label: string;
}

const LOW_SCORE_THRESHOLD = 50;

export function reviewSignals(lead: Lead): ReviewSignal[] {
  const signals: ReviewSignal[] = [];

  if (lead.status === "NEEDS_REVIEW") {
    signals.push({ reason: "needs_review", label: "Pipeline flagged Needs review" });
  }
  if (lead.leadScore !== null && lead.leadScore < LOW_SCORE_THRESHOLD && lead.status !== "NEW" && lead.status !== "PENDING") {
    signals.push({ reason: "low_score", label: `Low lead score (${lead.leadScore})` });
  }
  if (
    (lead.status === "ENRICHED" || lead.status === "NEEDS_REVIEW") &&
    lead.company &&
    !lead.companyDomain &&
    !lead.companyWebsite
  ) {
    signals.push({ reason: "missing_company_identity", label: "Company present but no domain/website" });
  }
  if (lead.addressValidation && /low-confidence/i.test(lead.addressValidation)) {
    signals.push({ reason: "low_address_confidence", label: "Low-confidence address match" });
  }

  return signals;
}

export function needsReview(lead: Lead): boolean {
  if (lead.reviewDecision === "NOT_FIT" || lead.reviewDecision === "FIT") {
    // Already actioned — drop from queue.
    return false;
  }
  return reviewSignals(lead).length > 0;
}
