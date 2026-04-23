import { BROAD_REAL_ESTATE_KEYWORDS } from "./constants.js";
import type { LeadAssessment, RepOutputs, ScoredLead } from "./types.js";
import { formatInlineInsights, normalizeComparisonText, truncate, uniqueStrings } from "./utils.js";

function looksLikeBroadRealEstateServicesFirm(assessment: LeadAssessment): boolean {
  const companyText = normalizeComparisonText(
    [
      assessment.normalized.company,
      assessment.company.legalName,
      assessment.company.description,
      assessment.company.businessType,
      assessment.company.industries.join(" ")
    ].join(" ")
  );

  return BROAD_REAL_ESTATE_KEYWORDS.some((keyword) => companyText.includes(normalizeComparisonText(keyword)));
}

function buildValidationClause(assessment: LeadAssessment): string {
  if (assessment.company.companyProfileFound && assessment.address.isValid) {
    return "While the company and address were validated";
  }

  if (assessment.company.companyProfileFound) {
    return "While the company identity was validated";
  }

  if (assessment.address.isValid) {
    return "While the address was validated";
  }

  return "The available lead data is still limited";
}

function isConditionalFit(scoredLead: ScoredLead): boolean {
  return scoredLead.fitLabel === "Possible fit only if the contact supports residential leasing or resident-facing property operations";
}

function formatMissingField(field: string): string {
  switch (field) {
    case "name":
      return "contact name";
    case "email":
      return "valid work email";
    case "company":
      return "company name";
    case "propertyAddress":
      return "street-level property address";
    case "city":
      return "property city";
    case "state":
      return "property state";
    case "country":
      return "property country";
    default:
      return field;
  }
}

function toSentenceList(values: string[]): string {
  if (values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

export function buildActionabilityOutputs(
  assessment: LeadAssessment,
  scoredLead: ScoredLead
): {
  whyPrioritize: string;
  whatsMissing: string;
} {
  const whyPrioritize = (() => {
    if (scoredLead.fitLabel === "Strong multifamily / property-operations fit") {
      const validationDetails = uniqueStrings([
        assessment.company.companyProfileFound ? "validated company identity" : "",
        assessment.address.isValid ? "validated property address" : ""
      ]);

      return truncate(
        `Strong multifamily/property-operations fit${validationDetails.length ? ` with ${toSentenceList(validationDetails)}` : ""}${assessment.locationContext.hasStrongHousingSignal ? ", plus a renter-dense local housing signal" : ""}.`,
        180
      );
    }

    if (isConditionalFit(scoredLead)) {
      return truncate(
        "Possible fit only if this contact supports residential leasing or resident operations at this location.",
        180
      );
    }

    if (scoredLead.fitLabel === "Possible residential property-operations fit") {
      return truncate(
        "Some residential property-operations signal is present, so this lead is worth a quick qualification pass.",
        180
      );
    }

    if (assessment.company.companyProfileFound || assessment.address.isValid) {
      return truncate(
        "Some core lead data was validated, but there is not yet a strong multifamily or residential property-management signal.",
        180
      );
    }

    return "No strong prioritize signal yet beyond the submitted lead details.";
  })();

  const missingItems = uniqueStrings([
    ...assessment.normalized.missingCriticalFields.map(formatMissingField),
    !assessment.normalized.emailValid ? "valid work email" : "",
    assessment.normalized.genericEmailDomain ? "non-generic work email or matching company domain" : "",
    !assessment.company.companyProfileFound ? "verified company profile" : "",
    !assessment.company.canonicalDomain ? "resolved company domain" : "",
    !assessment.address.isValid ? "validated property address" : "",
    assessment.normalized.propertyAddress && !assessment.address.isComplete ? "complete street-level address match" : "",
    isConditionalFit(scoredLead) ? "confirmation that the contact owns residential leasing or resident operations" : "",
    scoredLead.fitLabel === "Unclear fit" || scoredLead.fitLabel === "Possible residential property-operations fit"
      ? "clear multifamily or residential property-management signal"
      : ""
  ]);

  const whatsMissing =
    missingItems.length > 0
      ? truncate(`Still need ${toSentenceList(missingItems)}.`, 220)
      : "No major gaps; ready for outreach.";

  return {
    whyPrioritize,
    whatsMissing
  };
}

function buildFallbackOutreachEmail(assessment: LeadAssessment, companyName: string, scoredLead: ScoredLead): string {
  const propertyReference = assessment.address.formattedAddress || assessment.normalized.fullAddress;

  if (scoredLead.fitLabel === "Possible fit only if the contact supports residential leasing or resident-facing property operations") {
    return truncate(
      [
        `Hi ${assessment.normalized.name || "there"},`,
        "",
        `I’m reaching out because I found ${companyName}${propertyReference ? ` tied to ${propertyReference}` : ""}.`,
        "If your team supports residential leasing or resident-facing property operations there, EliseAI helps automate inbound leasing and resident communication workflows.",
        "I’d be happy to share a quick overview if that’s relevant.",
        "",
        "Best,"
      ].join("\n"),
      700
    );
  }

  return truncate(
    [
      `Hi ${assessment.normalized.name || "there"},`,
      "",
      `I came across ${companyName}${propertyReference ? ` associated with ${propertyReference}` : ""}.`,
      "If you support leasing or resident operations there, EliseAI helps multifamily teams automate renter inquiries and follow-up so onsite staff can respond faster and spend less time on manual coordination.",
      "Open to a quick conversation about how your team handles that today?",
      "",
      "Best,"
    ].join("\n"),
    700
  );
}

export function buildFallbackRepOutputs(assessment: LeadAssessment, scoredLead: ScoredLead): RepOutputs {
  const companyName = assessment.company.legalName || assessment.normalized.company || "This company";
  const broadRealEstateFirm = looksLikeBroadRealEstateServicesFirm(assessment);
  const enrichedCompanyInfo =
    scoredLead.fitLabel === "Possible fit only if the contact supports residential leasing or resident-facing property operations"
      ? truncate(
          [
            broadRealEstateFirm
              ? `${companyName} appears to be a broad commercial real estate services firm.`
              : `${companyName} appears to operate across broad real estate services rather than a clearly residential property-management niche.`,
            `${buildValidationClause(assessment)}, its relevance to EliseAI depends on whether this contact supports residential leasing or resident-facing property operations rather than broader real estate services.`
          ].join(" "),
          420
        )
      : truncate(
          [
            companyName,
            assessment.company.description,
            assessment.company.businessType,
            assessment.company.headquarters ? `HQ: ${assessment.company.headquarters}` : ""
          ]
            .filter(Boolean)
            .join(". "),
          420
        );

  const insightOne =
    scoredLead.fitLabel === "Strong multifamily / property-operations fit"
      ? "Strong multifamily/property-operations fit based on company profile and scale"
      : isConditionalFit(scoredLead)
        ? "Possible fit only if the contact supports residential leasing or resident-facing property operations at this location"
        : scoredLead.fitLabel === "Possible residential property-operations fit"
        ? "Possible multifamily/property-operations fit that needs quick review"
        : "Weak confidence in multifamily/property-operations fit from the available company context";

  const insightTwo = assessment.address.isValid
    ? "High confidence from resolved company domain and validated property address"
    : assessment.company.canonicalDomain
      ? "Moderate confidence from company and domain signals, but the property address is not fully validated"
      : "Low confidence because the lead still lacks a fully resolved company and property profile";

  const insightThree =
    assessment.locationContext.hasStrongHousingSignal && assessment.locationContext.summary
      ? `Prioritize now because ${assessment.locationContext.summary.toLowerCase()} and multifamily teams often carry meaningful renter inquiry volume`
      : scoredLead.score >= 75
        ? "Prioritize now because large operators often have meaningful leasing and resident inquiry volume"
        : isConditionalFit(scoredLead)
          ? "Deprioritize until the contact is confirmed to own residential leasing or resident-facing property operations"
          : "Hold for review until the record has clearer property details or stronger contact context";

  const salesInsights = truncate(formatInlineInsights([insightOne, insightTwo, insightThree].join(" • ")), 520);

  const draftOutreachEmail = buildFallbackOutreachEmail(assessment, companyName, scoredLead);

  return {
    enrichedCompanyInfo,
    salesInsights,
    draftOutreachEmail,
    usedFallback: true
  };
}
