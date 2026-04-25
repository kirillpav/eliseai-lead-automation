import { ALL_HEADERS, INPUT_HEADERS, STATUS } from "@shared/constants";
import type { HeaderName, LeadInput, LeadStatus } from "@shared/types";

export type ReviewDecision = "FIT" | "NOT_FIT" | "";
export type OutreachApproval = "YES" | "";

export interface Lead {
  rowNumber: number;
  name: string;
  email: string;
  company: string;
  propertyAddress: string;
  city: string;
  state: string;
  country: string;
  companyDomain: string;
  companyWebsite: string;
  enrichedCompanyInfo: string;
  addressValidation: string;
  leadScore: number | null;
  leadTier: string;
  leadScoreReason: string;
  salesInsights: string;
  whyPrioritize: string;
  whatsMissing: string;
  draftOutreachEmail: string;
  status: LeadStatus | "";
  lastProcessedAt: string;
  reviewDecision: ReviewDecision;
  outreachApproved: OutreachApproval;
  reviewedAt: string;
  reviewedBy: string;
}

type HeaderIndex = Partial<Record<HeaderName, number>>;

export function buildHeaderIndex(headerRow: unknown[]): HeaderIndex {
  const cleaned = headerRow.map((value) => (value == null ? "" : String(value).trim()));
  const index: HeaderIndex = {};
  for (const header of ALL_HEADERS) {
    const position = cleaned.indexOf(header);
    if (position >= 0) {
      index[header] = position;
    }
  }
  return index;
}

function cellString(row: unknown[], position: number | undefined): string {
  if (position === undefined) {
    return "";
  }
  const value = row[position];
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function cellNumber(row: unknown[], position: number | undefined): number | null {
  if (position === undefined) {
    return null;
  }
  const value = row[position];
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isStatus(value: string): value is LeadStatus {
  return value === "NEW" || value === "PENDING" || value === "ENRICHED" || value === "NEEDS_REVIEW" || value === "ERROR";
}

function toReviewDecision(value: string): ReviewDecision {
  const upper = value.toUpperCase();
  return upper === "FIT" || upper === "NOT_FIT" ? upper : "";
}

function toOutreachApproval(value: string): OutreachApproval {
  return value.toUpperCase() === "YES" ? "YES" : "";
}

export function rowToLead(row: unknown[], rowNumber: number, index: HeaderIndex): Lead {
  const statusRaw = cellString(row, index.Status).toUpperCase();
  return {
    rowNumber,
    name: cellString(row, index.Name),
    email: cellString(row, index.Email),
    company: cellString(row, index.Company),
    propertyAddress: cellString(row, index["Property Address"]),
    city: cellString(row, index.City),
    state: cellString(row, index.State),
    country: cellString(row, index.Country),
    companyDomain: cellString(row, index["Company Domain"]),
    companyWebsite: cellString(row, index["Company Website"]),
    enrichedCompanyInfo: cellString(row, index["Enriched Company Info"]),
    addressValidation: cellString(row, index["Address / Property Validation"]),
    leadScore: cellNumber(row, index["Lead Score"]),
    leadTier: cellString(row, index["Lead Tier"]),
    leadScoreReason: cellString(row, index["Lead Score Reason"]),
    salesInsights: cellString(row, index["Sales Insights"]),
    whyPrioritize: cellString(row, index["Why Prioritize"]),
    whatsMissing: cellString(row, index["What's Missing"]),
    draftOutreachEmail: cellString(row, index["Draft Outreach Email"]),
    status: isStatus(statusRaw) ? statusRaw : "",
    lastProcessedAt: cellString(row, index["Last Processed At"]),
    reviewDecision: toReviewDecision(cellString(row, index["Review Decision"])),
    outreachApproved: toOutreachApproval(cellString(row, index["Outreach Approved"])),
    reviewedAt: cellString(row, index["Reviewed At"]),
    reviewedBy: cellString(row, index["Reviewed By"])
  };
}

export function rowHasAnyContent(row: unknown[]): boolean {
  return row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "");
}

const INPUT_FIELD_BY_HEADER: Record<(typeof INPUT_HEADERS)[number], keyof LeadInput> = {
  Name: "name",
  Email: "email",
  Company: "company",
  "Property Address": "propertyAddress",
  City: "city",
  State: "state",
  Country: "country"
};

export type LeadCellUpdates = Partial<Record<HeaderName, string>>;

export function leadInputToRow(input: LeadInput, index: HeaderIndex, totalColumns: number): string[] {
  const missing = INPUT_HEADERS.filter((header) => index[header] === undefined);
  if (missing.length > 0) {
    throw new Error(`Sheet is missing required input columns: ${missing.join(", ")}. Open the Sheet so Apps Script can add them, then retry.`);
  }

  const values = new Array<string>(totalColumns).fill("");
  for (const header of INPUT_HEADERS) {
    const position = index[header];
    if (position === undefined || position >= totalColumns) {
      continue;
    }
    values[position] = input[INPUT_FIELD_BY_HEADER[header]];
  }

  const statusPosition = index.Status;
  if (statusPosition !== undefined && statusPosition < totalColumns) {
    values[statusPosition] = STATUS.NEW;
  }

  return values;
}
