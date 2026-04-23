import {
  BROAD_REAL_ESTATE_KEYWORDS,
  LEAD_TIERS,
  NEGATIVE_FIT_KEYWORDS,
  POSITIVE_FIT_KEYWORDS,
  SCORE_WEIGHTS,
  STATUS,
  STRONG_FIT_PHRASES
} from "./constants.js";
import type { LeadLogger } from "./logger.js";
import type { LeadAssessment, LeadTier, ScoredLead, ScoreSignal } from "./types.js";
import { clamp, normalizeComparisonText, truncate, uniqueStrings } from "./utils.js";

function countKeywordMatches(text: string, keywords: readonly string[]): string[] {
  return keywords.filter((keyword) => text.includes(normalizeComparisonText(keyword)));
}

function detectFit(assessment: LeadAssessment): {
  fitLabel: string;
  strongFit: boolean;
  conditionalFit: boolean;
  unrelated: boolean;
  positiveMatches: string[];
  negativeMatches: string[];
  broadRealEstateMatches: string[];
} {
  const companyText = normalizeComparisonText(
    [
      assessment.normalized.company,
      assessment.company.legalName,
      assessment.company.description,
      assessment.company.businessType,
      assessment.company.industries.join(" ")
    ].join(" ")
  );

  const positiveMatches = countKeywordMatches(companyText, POSITIVE_FIT_KEYWORDS);
  const negativeMatches = countKeywordMatches(companyText, NEGATIVE_FIT_KEYWORDS);
  const broadRealEstateMatches = countKeywordMatches(companyText, BROAD_REAL_ESTATE_KEYWORDS);
  const strongFit = STRONG_FIT_PHRASES.some((phrase) => companyText.includes(normalizeComparisonText(phrase))) || positiveMatches.length >= 2;
  const conditionalFit = broadRealEstateMatches.length > 0 && !strongFit;
  const unrelated = negativeMatches.length > 0 && positiveMatches.length === 0;

  if (strongFit) {
    return {
      fitLabel: "Strong multifamily / property-operations fit",
      strongFit,
      conditionalFit: false,
      unrelated,
      positiveMatches,
      negativeMatches,
      broadRealEstateMatches
    };
  }

  if (conditionalFit) {
    return {
      fitLabel: "Possible fit only if the contact supports residential leasing or resident-facing property operations",
      strongFit: false,
      conditionalFit: true,
      unrelated,
      positiveMatches,
      negativeMatches,
      broadRealEstateMatches
    };
  }

  if (positiveMatches.length > 0) {
    return {
      fitLabel: "Possible residential property-operations fit",
      strongFit: false,
      conditionalFit: false,
      unrelated,
      positiveMatches,
      negativeMatches,
      broadRealEstateMatches
    };
  }

  if (unrelated) {
    return {
      fitLabel: "Weak fit outside EliseAI's target workflow",
      strongFit: false,
      conditionalFit: false,
      unrelated,
      positiveMatches,
      negativeMatches,
      broadRealEstateMatches
    };
  }

  return {
    fitLabel: "Unclear fit",
    strongFit: false,
    conditionalFit: false,
    unrelated: false,
    positiveMatches,
    negativeMatches,
    broadRealEstateMatches
  };
}

function pushSignal(signals: ScoreSignal[], label: string, points: number): void {
  signals.push({ label, points });
}

export function deriveLeadTier(score: number): LeadTier {
  if (score >= 80) {
    return LEAD_TIERS.HOT;
  }

  if (score >= 55) {
    return LEAD_TIERS.WARM;
  }

  if (score >= 25) {
    return LEAD_TIERS.REVIEW;
  }

  return LEAD_TIERS.COLD;
}

function buildScoreReason(
  fit: ReturnType<typeof detectFit>,
  positiveSignals: string[],
  negativeSignals: string[],
  assessment: LeadAssessment
): string {
  const { company, address } = assessment;

  if (positiveSignals[0] && negativeSignals[0]) {
    const positiveClause =
      address.isValid && company.canonicalDomain
        ? "Company domain and property address were validated"
        : positiveSignals[0];

    const negativeClause =
      fit.conditionalFit
        ? "fit is uncertain because the company appears more commercial-real-estate-oriented than clearly multifamily or residential"
        : negativeSignals[0].toLowerCase();

    return truncate(`${positiveClause}, but ${negativeClause}.`, 220);
  }

  if (fit.conditionalFit) {
    const validationPrefix =
      company.companyProfileFound && address.isValid
        ? "Company identity and address were validated"
        : company.companyProfileFound
          ? "Company identity was validated"
          : address.isValid
            ? "Address was validated"
            : "Some lead details were validated";

    return truncate(
      `${validationPrefix}, but fit is uncertain because the company appears more commercial-real-estate-oriented than clearly multifamily or residential.`,
      220
    );
  }

  const reasonParts = uniqueStrings([
    positiveSignals[0] ? `Strongest positive: ${positiveSignals[0].toLowerCase()}` : "",
    negativeSignals[0] ? `Main risk: ${negativeSignals[0].toLowerCase()}` : ""
  ]);

  return truncate(
    reasonParts.length > 0 ? reasonParts.join(". ") + "." : "Limited signals were available for confident scoring.",
    220
  );
}

export function scoreLead(assessment: LeadAssessment, logger?: LeadLogger): ScoredLead {
  const signals: ScoreSignal[] = [];
  const fit = detectFit(assessment);
  const { normalized, company, address, locationContext } = assessment;

  if (fit.strongFit) {
    pushSignal(signals, "Company appears tied to multifamily, leasing, or housing operations", SCORE_WEIGHTS.strongFit);
  }

  if (company.website && company.canonicalDomain && company.sourceConfidence >= 0.6) {
    pushSignal(signals, "Website and company domain resolved with high confidence", SCORE_WEIGHTS.domainResolved);
  }

  if (address.isValid && address.isComplete && address.confidence >= 0.75) {
    pushSignal(signals, "Property address validated and complete", SCORE_WEIGHTS.addressValidated);
  }

  if (normalized.emailDomain && company.canonicalDomain && normalized.emailDomain === company.canonicalDomain) {
    pushSignal(signals, "Email domain matches the resolved company domain", SCORE_WEIGHTS.emailDomainMatch);
  }

  if (company.foundedYear !== null || Boolean(company.employeeBand)) {
    pushSignal(signals, "Company looks established based on firmographic signals", SCORE_WEIGHTS.establishedCompany);
  }

  if (address.isValid && (address.countryCode === "US" || address.countryCode === "CA")) {
    pushSignal(signals, "Address is in the primary US/Canada market", SCORE_WEIGHTS.targetMarketAddress);
  }

  if (company.corroboratedIdentity) {
    pushSignal(signals, "Company identity is supported by the resolved domain and company profile", SCORE_WEIGHTS.corroboratedIdentity);
  }

  if (locationContext.hasStrongHousingSignal) {
    pushSignal(signals, "Census data suggests a renter-dense residential market", SCORE_WEIGHTS.strongHousingContext);
  }

  const qualifiesExceptionalBonus =
    fit.strongFit &&
    company.companyProfileFound &&
    company.website !== "" &&
    normalized.emailDomain !== "" &&
    normalized.emailDomain === company.canonicalDomain &&
    address.isValid &&
    address.isComplete;

  if (qualifiesExceptionalBonus) {
    pushSignal(signals, "Lead has exceptional signal quality across fit, identity, and property validation", SCORE_WEIGHTS.exceptionalFitBonus);
  }

  if (fit.conditionalFit) {
    pushSignal(
      signals,
      "Fit is uncertain because the company looks like a broad real estate services firm rather than a clear multifamily or residential property-management lead",
      SCORE_WEIGHTS.conditionalFitUncertain
    );
  }

  const inconsistentCriticalFields =
    !normalized.hasRequiredFields ||
    !normalized.emailValid ||
    (normalized.emailDomain !== "" &&
      company.canonicalDomain !== "" &&
      !normalized.genericEmailDomain &&
      normalized.emailDomain !== company.canonicalDomain);

  if (inconsistentCriticalFields) {
    pushSignal(signals, "Critical lead fields are missing or inconsistent", SCORE_WEIGHTS.missingOrInconsistent);
  }

  if (fit.unrelated) {
    pushSignal(signals, "Company appears unrelated to multifamily or residential property operations", SCORE_WEIGHTS.unrelatedIndustry);
  }

  if (normalized.genericEmailDomain && !company.canonicalDomain) {
    pushSignal(signals, "Generic email with no verified company domain", SCORE_WEIGHTS.genericEmailNoDomain);
  }

  const rawScore = signals.reduce((sum, signal) => sum + signal.points, 0);
  const score = clamp(rawScore, 0, 100);
  const tier = deriveLeadTier(score);

  const positiveSignals = signals
    .filter((signal) => signal.points > 0)
    .sort((left, right) => right.points - left.points)
    .map((signal) => signal.label);

  const negativeSignals = signals
    .filter((signal) => signal.points < 0)
    .sort((left, right) => left.points - right.points)
    .map((signal) => signal.label);

  const scoreReason = buildScoreReason(fit, positiveSignals, negativeSignals, assessment);

  const recommendedStatus =
    !company.companyProfileFound ||
    !address.isValid ||
    !normalized.emailValid ||
    !normalized.hasRequiredFields ||
    score < 60 ||
    fit.conditionalFit ||
    fit.fitLabel === "Unclear fit"
      ? STATUS.NEEDS_REVIEW
      : STATUS.ENRICHED;

  const result = {
    score,
    tier,
    recommendedStatus,
    fitLabel: fit.fitLabel,
    scoreReason,
    positiveSignals,
    negativeSignals,
    signals
  };
  logger?.info("lead.scoring.completed", {
    score: result.score,
    tier: result.tier,
    recommendedStatus: result.recommendedStatus,
    fitLabel: result.fitLabel,
    positiveSignals: result.positiveSignals,
    negativeSignals: result.negativeSignals,
    signals: result.signals
  });
  return result;
}
