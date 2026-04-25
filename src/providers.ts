import { getConfig } from "./config.js";
import { fetchJson } from "./http.js";
import type { LeadLogger } from "./logger.js";
import type {
  AddressValidation,
  CompanyEnrichment,
  DataUsaContext,
  LeadAssessment,
  LocationContext,
  NormalizedLead
} from "./types.js";
import {
  buildQueryString,
  cleanText,
  formatLocation,
  normalizeComparisonText,
  normalizeDomain,
  normalizeWebsiteUrl,
  toNumberOrNull,
  truncate,
  uniqueStrings
} from "./utils.js";

interface TheCompaniesByNameResponse {
  companies?: unknown[];
  data?: {
    companies?: unknown[];
  };
}

interface CensusGeocoderResponse {
  result?: {
    addressMatches?: Array<{
      matchedAddress?: string;
      coordinates?: {
        x?: number;
        y?: number;
      };
      addressComponents?: Record<string, unknown>;
      geographies?: {
        "Census Tracts"?: Array<Record<string, unknown>>;
      };
      tigerLine?: {
        side?: string;
      };
    }>;
  };
}

type CensusAddressMatch = NonNullable<NonNullable<CensusGeocoderResponse["result"]>["addressMatches"]>[number];

function emptyCompanyEnrichment(): CompanyEnrichment {
  return {
    legalName: "",
    canonicalDomain: "",
    website: "",
    description: "",
    industries: [],
    businessType: "",
    employeeBand: "",
    foundedYear: null,
    headquarters: "",
    sourceConfidence: 0,
    usedEmailLookup: false,
    companyProfileFound: false,
    corroboratedIdentity: false
  };
}

function emptyAddressValidation(normalized: NormalizedLead): AddressValidation {
  return {
    formattedAddress: normalized.fullAddress,
    latitude: null,
    longitude: null,
    countryCode: cleanText(normalized.country).toUpperCase(),
    city: normalized.city,
    state: normalized.state,
    postcode: "",
    confidence: 0,
    cityConfidence: 0,
    streetConfidence: 0,
    buildingConfidence: 0,
    matchType: "",
    isValid: false,
    isComplete: false
  };
}

function emptyLocationContext(): LocationContext {
  return {
    available: false,
    summary: "",
    renterOccupiedPct: null,
    housingUnits: null,
    medianGrossRent: null,
    countyName: "",
    tractName: "",
    housingSignalLevel: "unknown",
    highRenterShare: false,
    largeHousingUnitBase: false,
    premiumRentMarket: false,
    housingSignalTags: [],
    housingContextTags: [],
    hasStrongHousingSignal: false
  };
}

function emptyDataUsaContext(): DataUsaContext {
  return {
    available: false,
    summary: "",
    population: null,
    medianHomeValue: null,
    medianHouseholdIncome: null
  };
}

function getTheCompaniesHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Basic ${token}`
  };
}

function mapTheCompaniesCompany(raw: Record<string, unknown>, usedEmailLookup: boolean): CompanyEnrichment {
  const about = (raw.about as Record<string, unknown> | undefined) ?? {};
  const descriptions = (raw.descriptions as Record<string, unknown> | undefined) ?? {};
  const domain = (raw.domain as Record<string, unknown> | undefined) ?? {};
  const locations = (raw.locations as Record<string, unknown> | undefined) ?? {};
  const headquarters = (locations.headquarters as Record<string, unknown> | undefined) ?? {};
  const canonicalDomain = normalizeDomain(cleanText(domain.domain));
  const website = normalizeWebsiteUrl(cleanText(descriptions.website), canonicalDomain);

  return {
    legalName: cleanText(about.nameLegal ?? about.name),
    canonicalDomain,
    website,
    description: truncate(cleanText(descriptions.primary), 320),
    industries: uniqueStrings([
      ...(Array.isArray(about.industries) ? (about.industries as unknown[]).map((value) => cleanText(value)) : []),
      cleanText(about.industry)
    ]),
    businessType: cleanText(about.businessType),
    employeeBand: cleanText(about.totalEmployees),
    foundedYear: toNumberOrNull(about.yearFounded),
    headquarters: formatLocation(
      cleanText(headquarters.city),
      cleanText(headquarters.state),
      cleanText(headquarters.country)
    ),
    sourceConfidence: 0.75,
    usedEmailLookup,
    companyProfileFound: true,
    corroboratedIdentity: false
  };
}

function getFirstCompany(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const response = raw as TheCompaniesByNameResponse;
  const companies = response.companies ?? response.data?.companies;
  if (!Array.isArray(companies) || companies.length === 0) {
    return null;
  }

  const first = companies[0];
  return typeof first === "object" && first !== null ? (first as Record<string, unknown>) : null;
}

function enrichViaTheCompanies(normalized: NormalizedLead, logger?: LeadLogger): CompanyEnrichment {
  const config = getConfig();
  if (!config.theCompaniesApiKey) {
    logger?.warn("provider.thecompanies.skipped", {
      reason: "missing-api-key"
    });
    return emptyCompanyEnrichment();
  }

  const headers = getTheCompaniesHeaders(config.theCompaniesApiKey);

  if (normalized.emailDomain && !normalized.genericEmailDomain) {
    logger?.info("provider.thecompanies.by-email.start", {
      email: normalized.email,
      emailDomain: normalized.emailDomain
    });
    try {
      const byEmailUrl = `https://api.thecompaniesapi.com/v2/companies/by-email?email=${encodeURIComponent(normalized.email)}&simplified=false`;
      const response = fetchJson<Record<string, unknown>>(byEmailUrl, { headers });
      const companyCandidate = (response.company as Record<string, unknown> | undefined) ?? response;
      if (
        companyCandidate &&
        typeof companyCandidate === "object" &&
        (companyCandidate.about || companyCandidate.domain || companyCandidate.descriptions)
      ) {
        const mapped = mapTheCompaniesCompany(companyCandidate, true);
        logger?.info("provider.thecompanies.by-email.hit", {
          legalName: mapped.legalName,
          canonicalDomain: mapped.canonicalDomain,
          website: mapped.website,
          confidence: mapped.sourceConfidence
        });
        return mapped;
      }
      logger?.warn("provider.thecompanies.by-email.miss", {
        reason: "empty-company-payload"
      });
    } catch (_error) {
      logger?.warn("provider.thecompanies.by-email.error", {
        error: _error
      });
      // Continue with name search or domain fallback if the email lookup does not resolve.
    }
  }

  if (!normalized.company) {
    logger?.warn("provider.thecompanies.by-name.skipped", {
      reason: "missing-company-name"
    });
    return emptyCompanyEnrichment();
  }

  const countries = cleanText(normalized.country).toLowerCase();
  const queryString = buildQueryString({
    name: normalized.company,
    size: 1,
    exactWordsMatch: false,
    countries
  });

  try {
    logger?.info("provider.thecompanies.by-name.start", {
      company: normalized.company,
      countries
    });
    const response = fetchJson<TheCompaniesByNameResponse>(
      `https://api.thecompaniesapi.com/v2/companies/by-name?${queryString}`,
      { headers }
    );
    const firstCompany = getFirstCompany(response);

    if (!firstCompany) {
      logger?.warn("provider.thecompanies.by-name.miss", {
        company: normalized.company
      });
      return emptyCompanyEnrichment();
    }

    const mapped = mapTheCompaniesCompany(firstCompany, false);
    logger?.info("provider.thecompanies.by-name.hit", {
      legalName: mapped.legalName,
      canonicalDomain: mapped.canonicalDomain,
      website: mapped.website,
      confidence: mapped.sourceConfidence
    });
    return mapped;
  } catch (_error) {
    logger?.warn("provider.thecompanies.by-name.error", {
      error: _error
    });
    return emptyCompanyEnrichment();
  }
}

export function enrichCompany(normalized: NormalizedLead, logger?: LeadLogger): CompanyEnrichment {
  let company = enrichViaTheCompanies(normalized, logger);

  if (!company.canonicalDomain && normalized.emailDomain && !normalized.genericEmailDomain) {
    company = {
      ...company,
      canonicalDomain: normalized.emailDomain,
      website: `https://${normalized.emailDomain}`,
      sourceConfidence: Math.max(company.sourceConfidence, 0.45)
    };
    logger?.info("provider.thecompanies.domain-fallback", {
      canonicalDomain: company.canonicalDomain,
      website: company.website
    });
  }

  const normalizedResolvedName = normalizeComparisonText(company.legalName || normalized.company).trim();
  const domainHintsCompany = normalizeComparisonText(
    `${company.canonicalDomain} ${company.website} ${company.description} ${company.businessType}`
  );
  const corroboratedIdentity = Boolean(
    normalizedResolvedName &&
      company.canonicalDomain &&
      normalized.emailDomain &&
      normalized.emailDomain === company.canonicalDomain &&
      domainHintsCompany.includes(normalizedResolvedName.split(" ")[0] ?? "")
  );

  return {
    ...company,
    corroboratedIdentity
  };
}

function geocodeViaCensus(fullAddress: string): CensusAddressMatch | null {
  const geocoderParams = buildQueryString({
    address: fullAddress,
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    format: "json"
  });

  const geocoderResponse = fetchJson<CensusGeocoderResponse>(
    `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?${geocoderParams}`
  );

  return geocoderResponse.result?.addressMatches?.[0] ?? null;
}

export function validateAddress(normalized: NormalizedLead, logger?: LeadLogger): AddressValidation {
  if (!normalized.fullAddress) {
    logger?.warn("provider.census.geocode.skipped", {
      reason: "missing-full-address"
    });
    return emptyAddressValidation(normalized);
  }

  const country = cleanText(normalized.country).toUpperCase();
  if (country && country !== "US" && country !== "USA" && country !== "UNITED STATES") {
    logger?.warn("provider.census.geocode.skipped", {
      reason: "unsupported-country",
      country
    });
    return {
      ...emptyAddressValidation(normalized),
      countryCode: country,
      matchType: "unsupported-country"
    };
  }

  let match: ReturnType<typeof geocodeViaCensus>;
  try {
    logger?.info("provider.census.geocode.start", {
      address: normalized.fullAddress
    });
    match = geocodeViaCensus(normalized.fullAddress);
  } catch (_error) {
    logger?.warn("provider.census.geocode.error", {
      address: normalized.fullAddress,
      error: _error
    });
    return emptyAddressValidation(normalized);
  }

  if (!match) {
    logger?.warn("provider.census.geocode.miss", {
      address: normalized.fullAddress
    });
    return emptyAddressValidation(normalized);
  }

  const matchedAddress = cleanText(match.matchedAddress) || normalized.fullAddress;
  const components = match.addressComponents ?? {};
  const hasStreetNumber = Boolean(cleanText(components.fromAddress));
  const hasStreetName = Boolean(cleanText(components.streetName));
  const hasCity = Boolean(cleanText(components.city));
  const hasState = Boolean(cleanText(components.state));
  const hasZip = Boolean(cleanText(components.zip));

  const validation = {
    formattedAddress: matchedAddress,
    latitude: toNumberOrNull(match.coordinates?.y),
    longitude: toNumberOrNull(match.coordinates?.x),
    countryCode: "US",
    city: cleanText(components.city) || normalized.city,
    state: cleanText(components.state) || normalized.state,
    postcode: cleanText(components.zip),
    confidence: hasStreetNumber && hasStreetName && hasCity && hasState ? 0.9 : hasCity && hasState ? 0.7 : 0.5,
    cityConfidence: hasCity ? 1 : 0,
    streetConfidence: hasStreetName ? 1 : 0,
    buildingConfidence: hasStreetNumber ? 1 : 0,
    matchType: cleanText(match.tigerLine?.side) ? "street" : "address",
    isValid: true,
    isComplete: hasStreetNumber && hasStreetName && hasCity && hasState && hasZip
  };
  logger?.info("provider.census.geocode.hit", validation);
  return validation;
}

function enrichLocationContextViaCensus(address: AddressValidation, logger?: LeadLogger): LocationContext {
  const config = getConfig();
  if (address.countryCode !== "US" || !address.formattedAddress) {
    logger?.warn("provider.census.context.skipped", {
      reason: "non-us-or-missing-address",
      countryCode: address.countryCode,
      formattedAddress: address.formattedAddress
    });
    return emptyLocationContext();
  }

  let match: ReturnType<typeof geocodeViaCensus>;
  try {
    logger?.info("provider.census.context.geocode.start", {
      address: address.formattedAddress
    });
    match = geocodeViaCensus(address.formattedAddress);
  } catch (_error) {
    logger?.warn("provider.census.context.geocode.error", {
      address: address.formattedAddress,
      error: _error
    });
    return emptyLocationContext();
  }

  const tract = match?.geographies?.["Census Tracts"]?.[0] ?? null;
  if (!tract) {
    logger?.warn("provider.census.context.no-tract", {
      address: address.formattedAddress
    });
    return emptyLocationContext();
  }

  const state = cleanText(tract.STATE);
  const county = cleanText(tract.COUNTY);
  const tractCode = cleanText(tract.TRACT);

  if (!state || !county || !tractCode) {
    logger?.warn("provider.census.context.invalid-tract-parts", {
      state,
      county,
      tractCode
    });
    return emptyLocationContext();
  }

  const censusParams = buildQueryString({
    get: "NAME,DP04_0047PE,DP04_0006E,DP04_0134E",
    for: `tract:${tractCode}`,
    in: `state:${state} county:${county}`,
    key: config.censusApiKey || undefined
  });

  let dataset: string[][];
  try {
    logger?.info("provider.census.context.acs.start", {
      state,
      county,
      tractCode
    });
    dataset = fetchJson<string[][]>(`https://api.census.gov/data/2024/acs/acs5/profile?${censusParams}`);
  } catch (_error) {
    logger?.warn("provider.census.context.acs.error", {
      state,
      county,
      tractCode,
      error: _error
    });
    return emptyLocationContext();
  }
  if (!Array.isArray(dataset) || dataset.length < 2) {
    logger?.warn("provider.census.context.acs.empty", {
      state,
      county,
      tractCode
    });
    return emptyLocationContext();
  }

  const headers = dataset[0];
  const values = dataset[1];
  const record = Object.fromEntries(headers.map((header, index) => [header, values[index]]));

  const renterOccupiedPct = toNumberOrNull(record.DP04_0047PE);
  const housingUnits = toNumberOrNull(record.DP04_0006E);
  const medianGrossRent = toNumberOrNull(record.DP04_0134E);
  const countyName = cleanText(tract.COUNTYNAME);
  const tractName = cleanText(record.NAME);
  const highRenterShare = renterOccupiedPct !== null && renterOccupiedPct >= 50;
  const largeHousingUnitBase = housingUnits !== null && housingUnits >= 5000;
  const premiumRentMarket = medianGrossRent !== null && medianGrossRent >= 1500;
  const housingSignalTags = uniqueStrings([
    highRenterShare ? "high renter share" : "",
    largeHousingUnitBase ? "large housing-unit base" : ""
  ]);
  const housingContextTags = uniqueStrings([
    ...housingSignalTags,
    premiumRentMarket ? "premium rent market" : ""
  ]);
  const availableMetricCount = [renterOccupiedPct, housingUnits].filter((value) => value !== null).length;
  const housingSignalLevel: LocationContext["housingSignalLevel"] =
    availableMetricCount === 0 ? "unknown" : housingSignalTags.length >= 2 ? "high" : housingSignalTags.length === 1 ? "medium" : "low";
  const hasStrongHousingSignal = housingSignalLevel === "high" || housingSignalLevel === "medium";

  const summaryParts = uniqueStrings([
    renterOccupiedPct !== null ? `renter share is ${renterOccupiedPct.toFixed(1)}%` : "",
    housingUnits !== null ? `${housingUnits.toLocaleString()} housing units` : "",
    medianGrossRent !== null ? `median gross rent is $${medianGrossRent.toLocaleString()}` : ""
  ]);

  const context = {
    available: true,
    summary: summaryParts.length > 0 ? truncate(summaryParts.join(", "), 180) : "",
    renterOccupiedPct,
    housingUnits,
    medianGrossRent,
    countyName,
    tractName,
    housingSignalLevel,
    highRenterShare,
    largeHousingUnitBase,
    premiumRentMarket,
    housingSignalTags,
    housingContextTags,
    hasStrongHousingSignal
  };
  logger?.info("provider.census.context.hit", context);
  return context;
}

export function enrichLocationContext(_normalized: NormalizedLead, address: AddressValidation, logger?: LeadLogger): LocationContext {
  return enrichLocationContextViaCensus(address, logger);
}

export function enrichLocationContextViaDataUsa(_address: AddressValidation, logger?: LeadLogger): DataUsaContext {
  logger?.info("provider.datausa.scaffold.skipped", {
    reason: "scaffold-not-enabled"
  });
  return emptyDataUsaContext();
}

export function buildAssessment(normalized: NormalizedLead, logger?: LeadLogger): LeadAssessment {
  const company = enrichCompany(normalized, logger);
  const address = validateAddress(normalized, logger);
  const locationContext = enrichLocationContext(normalized, address, logger);
  enrichLocationContextViaDataUsa(address, logger);

  return {
    normalized,
    company,
    address,
    locationContext
  };
}
