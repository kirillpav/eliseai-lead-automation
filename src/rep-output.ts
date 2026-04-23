import { BROAD_REAL_ESTATE_KEYWORDS } from "./constants.js";
import type { LeadAssessment, RepOutputs, ScoredLead } from "./types.js";
import { formatInlineInsights, normalizeComparisonText, truncate } from "./utils.js";

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
      : scoredLead.fitLabel === "Possible fit only if the contact supports residential leasing or resident-facing property operations"
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
        : scoredLead.fitLabel === "Possible fit only if the contact supports residential leasing or resident-facing property operations"
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
