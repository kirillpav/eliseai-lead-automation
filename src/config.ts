import type { AppConfig } from "./types.js";

function getPropertyStore(): GoogleAppsScript.Properties.Properties {
  return PropertiesService.getScriptProperties();
}

function getProperty(name: string, fallback = ""): string {
  return getPropertyStore().getProperty(name) ?? fallback;
}

export function getConfig(): AppConfig {
  return {
    openAiApiKey: getProperty("OPENAI_API_KEY"),
    openAiModel: getProperty("OPENAI_MODEL", "gpt-5.4-mini"),
    theCompaniesApiKey: getProperty("THECOMPANIES_API_KEY"),
    censusApiKey: getProperty("CENSUS_API_KEY"),
    leadsSheetName: getProperty("LEADS_SHEET_NAME", "Leads"),
    sweepIntervalMinutes: Number(getProperty("SWEEP_INTERVAL_MINUTES", "5")) || 5
  };
}
