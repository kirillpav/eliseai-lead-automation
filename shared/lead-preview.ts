export interface LeadPreviewPayload {
  timestamp: string;
  source: "apps-script";
  runId: string;
  leadRowNumber: number;
  processingStatus: string;
  errorMessage: string;
  input: unknown;
  normalized: unknown;
  company: unknown;
  address: unknown;
  locationContext: unknown;
  scoredLead: unknown;
  repOutputs: unknown;
  rowOutput: unknown;
}

export interface LeadPreviewRecord {
  id: number;
  createdAt: string;
  source: "apps-script";
  runId: string;
  leadRowNumber: number;
  leadName: string;
  leadEmail: string;
  leadCompany: string;
  propertyAddress: string;
  processingStatus: string;
  leadScore: number | null;
  leadTier: string;
  leadScoreReason: string;
  salesInsights: string;
  whyPrioritize: string;
  whatsMissing: string;
  draftOutreachEmail: string;
  errorMessage: string;
  inputJson: string;
  normalizedJson: string;
  companyJson: string;
  addressJson: string;
  locationContextJson: string;
  scoredLeadJson: string;
  repOutputsJson: string;
  rowOutputJson: string;
}

export interface LeadPreviewFilters {
  status?: string;
  query?: string;
}

export interface LeadPreviewStatusCount {
  status: string;
  count: number;
}

export interface LeadPreviewSummary {
  totalRuns: number;
  averageScore: number | null;
  statusCounts: LeadPreviewStatusCount[];
}
