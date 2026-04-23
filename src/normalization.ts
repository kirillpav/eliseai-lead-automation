import { GENERIC_EMAIL_DOMAINS } from "./constants.js";
import type { LeadInput, NormalizedLead } from "./types.js";
import { buildFullAddress, cleanText, extractDomainFromEmail, isValidEmail } from "./utils.js";

export function normalizeLead(input: LeadInput): NormalizedLead {
  const name = cleanText(input.name);
  const email = cleanText(input.email).toLowerCase();
  const company = cleanText(input.company);
  const propertyAddress = cleanText(input.propertyAddress);
  const city = cleanText(input.city);
  const state = cleanText(input.state);
  const country = cleanText(input.country);
  const emailDomain = extractDomainFromEmail(email);

  const missingCriticalFields = [
    !name ? "name" : "",
    !email ? "email" : "",
    !company ? "company" : "",
    !propertyAddress ? "property address" : "",
    !city ? "city" : "",
    !country ? "country" : ""
  ].filter(Boolean);

  return {
    name,
    email,
    company,
    propertyAddress,
    city,
    state,
    country,
    fullAddress: buildFullAddress([propertyAddress, city, state, country]),
    normalizedCompany: company,
    emailLower: email,
    emailDomain,
    genericEmailDomain: GENERIC_EMAIL_DOMAINS.has(emailDomain),
    emailValid: isValidEmail(email),
    missingCriticalFields,
    hasRequiredFields: missingCriticalFields.length === 0
  };
}
