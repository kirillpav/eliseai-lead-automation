import { ALL_HEADERS, INPUT_HEADERS, OUTPUT_HEADERS, STATUS } from "./constants.js";
import { getConfig } from "./config.js";
import type { HeaderMap, LeadInput, LeadStatus, SheetRowOutput } from "./types.js";
import { cleanText, nowIsoString } from "./utils.js";

function toHeaderMap(headers: string[]): HeaderMap {
  return Object.fromEntries(ALL_HEADERS.map((header) => [header, headers.indexOf(header)])) as HeaderMap;
}

export function getLeadSheet(): GoogleAppsScript.Spreadsheet.Sheet {
  const { leadsSheetName } = getConfig();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const existing = spreadsheet.getSheetByName(leadsSheetName);
  if (existing) {
    return existing;
  }

  return spreadsheet.insertSheet(leadsSheetName);
}

export function ensureLeadSheet(): HeaderMap {
  const sheet = getLeadSheet();
  const lastColumn = Math.max(sheet.getLastColumn(), ALL_HEADERS.length);
  const headerValues =
    sheet.getLastRow() >= 1 ? (sheet.getRange(1, 1, 1, lastColumn).getValues()[0] as string[]) : [];

  const existingHeaders = headerValues.map((value) => cleanText(value));
  const missingHeaders = ALL_HEADERS.filter((header) => !existingHeaders.includes(header));

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, ALL_HEADERS.length).setValues([Array.from(ALL_HEADERS)]);
    sheet.setFrozenRows(1);
    return toHeaderMap(Array.from(ALL_HEADERS));
  }

  if (missingHeaders.length > 0) {
    const nextColumn = existingHeaders.filter(Boolean).length + 1;
    sheet.getRange(1, nextColumn, 1, missingHeaders.length).setValues([missingHeaders]);
  }

  const refreshedHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), ALL_HEADERS.length)).getValues()[0].map(cleanText);
  return toHeaderMap(refreshedHeaders);
}

export function readLeadInput(sheet: GoogleAppsScript.Spreadsheet.Sheet, rowNumber: number, headerMap: HeaderMap): LeadInput {
  const rowValues = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];

  return {
    name: cleanText(rowValues[headerMap["Name"]]),
    email: cleanText(rowValues[headerMap["Email"]]),
    company: cleanText(rowValues[headerMap["Company"]]),
    propertyAddress: cleanText(rowValues[headerMap["Property Address"]]),
    city: cleanText(rowValues[headerMap["City"]]),
    state: cleanText(rowValues[headerMap["State"]]),
    country: cleanText(rowValues[headerMap["Country"]])
  };
}

export function getRowStatus(sheet: GoogleAppsScript.Spreadsheet.Sheet, rowNumber: number, headerMap: HeaderMap): LeadStatus | "" {
  const value = cleanText(sheet.getRange(rowNumber, headerMap.Status + 1).getValue()).toUpperCase();
  if (!value) {
    return "";
  }

  return value as LeadStatus;
}

export function rowHasAnyInput(input: LeadInput): boolean {
  return Object.values(input).some(Boolean);
}

export function initializeRowStatusIfBlank(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  rowNumber: number,
  headerMap: HeaderMap,
  input: LeadInput
): LeadStatus | "" {
  const currentStatus = getRowStatus(sheet, rowNumber, headerMap);
  if (currentStatus || !rowHasAnyInput(input)) {
    return currentStatus;
  }

  sheet.getRange(rowNumber, headerMap.Status + 1).setValue(STATUS.NEW);
  return STATUS.NEW;
}

export function writeRowOutput(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  rowNumber: number,
  headerMap: HeaderMap,
  output: Partial<SheetRowOutput>
): void {
  const rowValues = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];

  for (const [header, value] of Object.entries(output)) {
    const index = headerMap[header as keyof HeaderMap];
    if (index >= 0) {
      rowValues[index] = value;
    }
  }

  sheet.getRange(rowNumber, 1, 1, rowValues.length).setValues([rowValues]);
}

export function setRowStatus(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  rowNumber: number,
  headerMap: HeaderMap,
  status: LeadStatus
): void {
  writeRowOutput(sheet, rowNumber, headerMap, {
    Status: status,
    "Last Processed At": nowIsoString()
  });
}

export function formatAddressValidationSummary(
  formattedAddress: string,
  isValid: boolean,
  confidence: number,
  matchType: string
): string {
  const confidencePct = Math.round(confidence * 100);
  if (!formattedAddress) {
    return "No validated address returned.";
  }

  return `${isValid ? "Validated" : "Low-confidence"} address${matchType ? ` (${matchType})` : ""}: ${formattedAddress}. Confidence ${confidencePct}%.`;
}

export function outputColumnNames(): readonly string[] {
  return OUTPUT_HEADERS;
}

export function inputColumnNames(): readonly string[] {
  return INPUT_HEADERS;
}
