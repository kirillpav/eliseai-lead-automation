export function cleanText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

export function normalizeDomain(value: string): string {
  const cleaned = cleanText(value).toLowerCase();
  if (!cleaned) {
    return "";
  }

  return cleaned
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function buildQueryString(params: Record<string, string | number | boolean | null | undefined>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

export function normalizeWebsiteUrl(value: string, fallbackDomain = ""): string {
  const cleaned = cleanText(value);
  if (cleaned && !/\s/.test(cleaned)) {
    if (/^https?:\/\//i.test(cleaned)) {
      return cleaned;
    }

    const normalizedDomain = normalizeDomain(cleaned);
    if (normalizedDomain) {
      return `https://${normalizedDomain}`;
    }
  }

  const fallback = normalizeDomain(fallbackDomain);
  return fallback ? `https://${fallback}` : "";
}

export function extractDomainFromEmail(email: string): string {
  const normalized = cleanText(email).toLowerCase();
  const match = normalized.match(/^[^@\s]+@([^@\s]+\.[^@\s]+)$/);
  return match ? normalizeDomain(match[1]) : "";
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(email).toLowerCase());
}

export function buildFullAddress(parts: Array<string | undefined>): string {
  return parts
    .map((part) => cleanText(part))
    .filter(Boolean)
    .join(", ");
}

export function truncate(value: string, maxLength: number): string {
  const cleaned = cleanText(value);
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export function formatInlineInsights(value: string): string {
  const normalized = String(value ?? "")
    .replace(/\r/g, "\n")
    .replace(/\s+\|\s+/g, "\n")
    .replace(/\s+•\s+/g, "\n");

  const parts = normalized
    .split(/\n+/)
    .map((part) =>
      cleanText(part)
        .replace(/^[-*]\s*/, "")
        .replace(/^(fit|confidence|prioritize now)\s*[:\-–—]\s*/i, "")
    )
    .filter(Boolean);

  return uniqueStrings(parts).join(" • ");
}

export function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const value of values) {
    const cleaned = cleanText(value);
    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(cleaned);
  }

  return results;
}

export function normalizeComparisonText(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function nowIsoString(): string {
  return new Date().toISOString();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isTargetMarketCountryCode(code: string): boolean {
  const normalized = cleanText(code).toUpperCase();
  return normalized === "US" || normalized === "USA" || normalized === "CA" || normalized === "CANADA";
}

export function formatLocation(city: string, state: string, country: string): string {
  return buildFullAddress([city, state, country]);
}
