import { getConfig } from "./config.js";
import { STATUS } from "./constants.js";
import { processLeadRow as processLeadRowInternal, processNewLeadRows as processNewLeadRowsInternal } from "./pipeline.js";
import { ensureLeadSheet as ensureLeadSheetInternal, initializeRowStatusIfBlank, readLeadInput } from "./sheets.js";

function addMenu(): void {
  SpreadsheetApp.getUi()
    .createMenu("EliseAI Leads")
    .addItem("Process New Leads", "processNewLeadRows")
    .addItem("Ensure Lead Sheet", "ensureLeadSheet")
    .addSeparator()
    .addItem("Install Triggers", "installTriggers")
    .addItem("Reset Triggers", "resetTriggers")
    .addToUi();
}

function isRelevantEdit(event: GoogleAppsScript.Events.SheetsOnEdit, statusColumn: number): boolean {
  const firstColumn = event.range.getColumn();
  const lastColumn = event.range.getLastColumn();
  return lastColumn >= 1 && firstColumn <= statusColumn + 1;
}

export function onOpen(): void {
  addMenu();
  try {
    ensureLeadSheetInternal();
  } catch (error) {
    console.error("Failed to initialize lead sheet on open", error);
  }
}

export function onEdit(event: GoogleAppsScript.Events.SheetsOnEdit): void {
  if (!event?.range) {
    return;
  }

  const sheet = event.range.getSheet();
  const { leadsSheetName } = getConfig();
  if (sheet.getName() !== leadsSheetName) {
    return;
  }

  const headerMap = ensureLeadSheetInternal();
  if (!isRelevantEdit(event, headerMap.Status)) {
    return;
  }

  const startRow = event.range.getRow();
  const endRow = event.range.getLastRow();

  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    if (rowNumber === 1) {
      continue;
    }

    const input = readLeadInput(sheet, rowNumber, headerMap);
    const status = initializeRowStatusIfBlank(sheet, rowNumber, headerMap, input);
    if (status === STATUS.NEW) {
      processLeadRowInternal(rowNumber);
    }
  }
}

export function installTriggers(): void {
  resetTriggers();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const { sweepIntervalMinutes } = getConfig();

  ScriptApp.newTrigger("onEdit").forSpreadsheet(spreadsheet).onEdit().create();
  ScriptApp.newTrigger("processNewLeadRows").timeBased().everyMinutes(sweepIntervalMinutes).create();
}

export function resetTriggers(): void {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    const handler = trigger.getHandlerFunction();
    if (handler === "onEdit" || handler === "processNewLeadRows") {
      ScriptApp.deleteTrigger(trigger);
    }
  }
}

export function ensureLeadSheet(): void {
  ensureLeadSheetInternal();
}

export function processNewLeadRows(): number {
  return processNewLeadRowsInternal();
}

export function processLeadRow(rowNumber: number): void {
  processLeadRowInternal(rowNumber);
}
