import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";
import { ALL_HEADERS } from "@shared/constants";
import type { HeaderName, LeadInput } from "@shared/types";
import { getEnv } from "./env";
import {
  buildHeaderIndex,
  leadInputToRow,
  rowHasAnyContent,
  rowToLead,
  type Lead,
  type LeadCellUpdates
} from "./lead-mapper";

let cachedClient: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (cachedClient) {
    return cachedClient;
  }

  const env = getEnv();
  const auth = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

function escapeSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

function sheetRange(sheetName: string, suffix: string): string {
  return `${escapeSheetName(sheetName)}!${suffix}`;
}

export async function listLeads(): Promise<Lead[]> {
  const env = getEnv();
  const sheets = getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEETS_ID,
    range: sheetRange(env.LEADS_SHEET_NAME, "A1:Z"),
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING"
  });

  const values = response.data.values ?? [];
  if (values.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = values;
  const index = buildHeaderIndex(headerRow);

  const leads: Lead[] = [];
  dataRows.forEach((row, offset) => {
    if (!rowHasAnyContent(row)) {
      return;
    }
    leads.push(rowToLead(row, offset + 2, index));
  });

  return leads;
}

export async function appendLead(input: LeadInput): Promise<{ rowNumber: number }> {
  const env = getEnv();
  const sheets = getClient();

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEETS_ID,
    range: sheetRange(env.LEADS_SHEET_NAME, "1:1"),
    valueRenderOption: "UNFORMATTED_VALUE"
  });

  const headerRow = headerResponse.data.values?.[0] ?? [];
  if (headerRow.length === 0) {
    throw new Error(
      `Sheet "${env.LEADS_SHEET_NAME}" has no header row. Open the Sheet so the Apps Script ensureLeadSheet runs, then retry.`
    );
  }

  const index = buildHeaderIndex(headerRow);
  const totalColumns = Math.max(headerRow.length, ALL_HEADERS.length);
  const newRow = leadInputToRow(input, index, totalColumns);

  const append = await sheets.spreadsheets.values.append({
    spreadsheetId: env.GOOGLE_SHEETS_ID,
    range: sheetRange(env.LEADS_SHEET_NAME, "A1"),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [newRow]
    }
  });

  const updatedRange = append.data.updates?.updatedRange ?? "";
  const match = updatedRange.match(/!(?:[A-Z]+)(\d+):/);
  const rowNumber = match ? Number(match[1]) : NaN;

  return { rowNumber: Number.isFinite(rowNumber) ? rowNumber : -1 };
}

function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export async function updateLeadCells(rowNumber: number, updates: LeadCellUpdates): Promise<void> {
  const headers = Object.keys(updates) as HeaderName[];
  if (headers.length === 0) {
    return;
  }
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new Error(`Invalid row number: ${rowNumber}`);
  }

  const env = getEnv();
  const sheets = getClient();

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEETS_ID,
    range: sheetRange(env.LEADS_SHEET_NAME, "1:1"),
    valueRenderOption: "UNFORMATTED_VALUE"
  });
  const headerRow = headerResponse.data.values?.[0] ?? [];
  const index = buildHeaderIndex(headerRow);

  const data: sheets_v4.Schema$ValueRange[] = [];
  const missing: HeaderName[] = [];
  for (const header of headers) {
    const position = index[header];
    if (position === undefined) {
      missing.push(header);
      continue;
    }
    const column = columnLetter(position);
    data.push({
      range: sheetRange(env.LEADS_SHEET_NAME, `${column}${rowNumber}`),
      values: [[updates[header] ?? ""]]
    });
  }

  if (missing.length > 0) {
    throw new Error(
      `Sheet is missing required columns: ${missing.join(", ")}. Open the Sheet so Apps Script's ensureLeadSheet adds them, then retry.`
    );
  }

  if (data.length === 0) {
    return;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: env.GOOGLE_SHEETS_ID,
    requestBody: {
      valueInputOption: "RAW",
      data
    }
  });
}
