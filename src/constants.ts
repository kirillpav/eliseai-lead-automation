export const INPUT_HEADERS = [
  "Name",
  "Email",
  "Company",
  "Property Address",
  "City",
  "State",
  "Country"
] as const;

export const OUTPUT_HEADERS = [
  "Company Domain",
  "Company Website",
  "Enriched Company Info",
  "Address / Property Validation",
  "Lead Score",
  "Lead Tier",
  "Lead Score Reason",
  "Sales Insights",
  "Why Prioritize",
  "What's Missing",
  "Draft Outreach Email",
  "Status",
  "Last Processed At"
] as const;

// Columns written by the web dashboard's review queue. The Apps Script pipeline
// does NOT read or write these — they're rep metadata only.
export const REVIEW_HEADERS = [
  "Review Decision",
  "Outreach Approved",
  "Reviewed At",
  "Reviewed By"
] as const;

export const ALL_HEADERS = [...INPUT_HEADERS, ...OUTPUT_HEADERS, ...REVIEW_HEADERS] as const;

export const STATUS = {
  NEW: "NEW",
  PENDING: "PENDING",
  ENRICHED: "ENRICHED",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  ERROR: "ERROR"
} as const;

export const TARGET_MARKET_COUNTRIES = new Set(["US", "USA", "UNITED STATES", "CA", "CANADA"]);

export const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "msn.com",
  "proton.me",
  "protonmail.com"
]);

export const POSITIVE_FIT_KEYWORDS = [
  "multifamily",
  "multi-family",
  "apartment",
  "apartments",
  "residential property management",
  "multifamily property management",
  "property operations",
  "housing operations",
  "residential operations",
  "multifamily leasing",
  "residential leasing",
  "leasing teams",
  "resident communication",
  "lease-up",
  "rental communities",
  "resident services",
  "owner operator",
  "owner-operator",
  "community management",
  "apartment communities",
  "build to rent",
  "build-to-rent"
] as const;

export const NEGATIVE_FIT_KEYWORDS = [
  "construction supplier",
  "construction materials",
  "law firm",
  "attorney",
  "legal services",
  "architect",
  "architecture",
  "title company",
  "escrow",
  "generic consultant",
  "consulting",
  "insurance broker",
  "commercial brokerage",
  "mortgage broker",
  "staging",
  "interior design",
  "roofing",
  "hvac contractor",
  "plumbing contractor"
] as const;

export const BROAD_REAL_ESTATE_KEYWORDS = [
  "commercial real estate",
  "commercial property",
  "real estate services",
  "commercial brokerage",
  "brokerage services",
  "capital markets",
  "investment sales",
  "tenant representation",
  "office leasing",
  "workplace",
  "facilities management",
  "valuation",
  "real estate advisory"
] as const;

export const STRONG_FIT_PHRASES = [
  "residential property management",
  "multifamily",
  "housing operations",
  "property operations",
  "multifamily leasing",
  "residential leasing"
] as const;

export const SCORE_WEIGHTS = {
  strongFit: 24,
  domainResolved: 12,
  addressValidated: 12,
  emailDomainMatch: 8,
  establishedCompany: 8,
  targetMarketAddress: 6,
  corroboratedIdentity: 4,
  strongHousingContext: 4,
  exceptionalFitBonus: 12,
  conditionalFitUncertain: -6,
  missingOrInconsistent: -18,
  unrelatedIndustry: -24,
  genericEmailNoDomain: -12
} as const;

export const LEAD_TIERS = {
  HOT: "HOT",
  WARM: "WARM",
  REVIEW: "REVIEW",
  COLD: "COLD"
} as const;

export const LEAD_TIER_STYLES = {
  HOT: {
    background: "#d93025",
    fontColor: "#ffffff"
  },
  WARM: {
    background: "#f29900",
    fontColor: "#1f1f1f"
  },
  REVIEW: {
    background: "#fbbc04",
    fontColor: "#1f1f1f"
  },
  COLD: {
    background: "#9aa0a6",
    fontColor: "#ffffff"
  }
} as const;

export const OPENAI_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["enrichedCompanyInfo", "salesInsights", "draftOutreachEmail"],
  properties: {
    enrichedCompanyInfo: {
      type: "string",
      description: "One or two concise sentences about the company and why it matters to a sales rep."
    },
    salesInsights: {
      type: "string",
      description: "Exactly three short SDR-friendly insights joined with ' • ' on one line, with no labels, markdown bullets, or pipes."
    },
    draftOutreachEmail: {
      type: "string",
      description: "A short plain-text outreach email tailored to the lead."
    }
  }
} as const;
