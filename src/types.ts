import type { ALL_HEADERS, LEAD_TIERS, STATUS } from "./constants.js";

export type HeaderName = (typeof ALL_HEADERS)[number];
export type LeadStatus = (typeof STATUS)[keyof typeof STATUS];
export type LeadTier = (typeof LEAD_TIERS)[keyof typeof LEAD_TIERS];

export interface AppConfig {
  openAiApiKey: string;
  openAiModel: string;
  theCompaniesApiKey: string;
  censusApiKey: string;
  analyticsBaseUrl: string;
  analyticsIngestToken: string;
  leadsSheetName: string;
  sweepIntervalMinutes: number;
}

export interface LeadInput {
  name: string;
  email: string;
  company: string;
  propertyAddress: string;
  city: string;
  state: string;
  country: string;
}

export interface NormalizedLead extends LeadInput {
  fullAddress: string;
  normalizedCompany: string;
  emailLower: string;
  emailDomain: string;
  genericEmailDomain: boolean;
  emailValid: boolean;
  missingCriticalFields: string[];
  hasRequiredFields: boolean;
}

export interface CompanyEnrichment {
  legalName: string;
  canonicalDomain: string;
  website: string;
  description: string;
  industries: string[];
  businessType: string;
  employeeBand: string;
  foundedYear: number | null;
  headquarters: string;
  sourceConfidence: number;
  usedEmailLookup: boolean;
  companyProfileFound: boolean;
  corroboratedIdentity: boolean;
}

export interface AddressValidation {
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
  countryCode: string;
  city: string;
  state: string;
  postcode: string;
  confidence: number;
  cityConfidence: number;
  streetConfidence: number;
  buildingConfidence: number;
  matchType: string;
  isValid: boolean;
  isComplete: boolean;
}

export interface LocationContext {
  available: boolean;
  summary: string;
  renterOccupiedPct: number | null;
  housingUnits: number | null;
  medianGrossRent: number | null;
  countyName: string;
  tractName: string;
  hasStrongHousingSignal: boolean;
}

export interface DataUsaContext {
  available: boolean;
  summary: string;
  population: number | null;
  medianHomeValue: number | null;
  medianHouseholdIncome: number | null;
}

export interface ScoreSignal {
  label: string;
  points: number;
}

export interface ScoredLead {
  score: number;
  tier: LeadTier;
  recommendedStatus: LeadStatus;
  fitLabel: string;
  scoreReason: string;
  positiveSignals: string[];
  negativeSignals: string[];
  signals: ScoreSignal[];
}

export interface RepOutputs {
  enrichedCompanyInfo: string;
  salesInsights: string;
  draftOutreachEmail: string;
  usedFallback: boolean;
}

export interface LeadAssessment {
  normalized: NormalizedLead;
  company: CompanyEnrichment;
  address: AddressValidation;
  locationContext: LocationContext;
}

export interface SheetRowOutput {
  "Company Domain": string;
  "Company Website": string;
  "Enriched Company Info": string;
  "Address / Property Validation": string;
  "Lead Score": number;
  "Lead Tier": LeadTier;
  "Lead Score Reason": string;
  "Sales Insights": string;
  "Why Prioritize": string;
  "What's Missing": string;
  "Draft Outreach Email": string;
  Status: LeadStatus;
  "Last Processed At": string;
}

export type HeaderMap = Record<HeaderName, number>;
