import assert from "node:assert/strict";
import test from "node:test";

import { scoreLead } from "../src/scoring.js";
import type { LeadAssessment } from "../src/types.js";

function makeAssessment(overrides: Partial<LeadAssessment> = {}): LeadAssessment {
  return {
    normalized: {
      name: "Sarah Chen",
      email: "sarah@acmeproperty.com",
      company: "Acme Property Group",
      propertyAddress: "123 Main St",
      city: "Dallas",
      state: "TX",
      country: "United States",
      fullAddress: "123 Main St, Dallas, TX, United States",
      normalizedCompany: "Acme Property Group",
      emailLower: "sarah@acmeproperty.com",
      emailDomain: "acmeproperty.com",
      genericEmailDomain: false,
      emailValid: true,
      missingCriticalFields: [],
      hasRequiredFields: true
    },
    company: {
      legalName: "Acme Property Group",
      canonicalDomain: "acmeproperty.com",
      website: "https://acmeproperty.com",
      description: "Residential property management company serving multifamily apartment communities.",
      industries: ["Property Management", "Multifamily Housing"],
      businessType: "Residential property management",
      employeeBand: "51-200",
      foundedYear: 2011,
      headquarters: "Dallas, TX, United States",
      sourceConfidence: 0.9,
      usedEmailLookup: true,
      companyProfileFound: true,
      corroboratedIdentity: true
    },
    address: {
      formattedAddress: "123 Main St, Dallas, TX 75201, United States",
      latitude: 32.7767,
      longitude: -96.797,
      countryCode: "US",
      city: "Dallas",
      state: "TX",
      postcode: "75201",
      confidence: 0.93,
      cityConfidence: 0.99,
      streetConfidence: 0.98,
      buildingConfidence: 0.9,
      matchType: "building",
      isValid: true,
      isComplete: true
    },
    locationContext: {
      available: true,
      summary: "renter share is 61.2%, 8,200 housing units, median gross rent is $1,850",
      renterOccupiedPct: 61.2,
      housingUnits: 8200,
      medianGrossRent: 1850,
      countyName: "Dallas County",
      tractName: "Census Tract 1",
      hasStrongHousingSignal: true
    },
    ...overrides
  };
}

test("scoreLead rewards strong multifamily and validated data signals", () => {
  const scored = scoreLead(makeAssessment());

  assert.equal(scored.recommendedStatus, "ENRICHED");
  assert.equal(scored.score, 90);
  assert.match(scored.fitLabel, /Strong multifamily/);
  assert.ok(scored.positiveSignals.some((signal) => signal.includes("multifamily")));
  assert.ok(scored.positiveSignals.some((signal) => signal.includes("exceptional signal quality")));
});

test("scoreLead penalizes unrelated adjacent businesses", () => {
  const scored = scoreLead(
    makeAssessment({
      company: {
        ...makeAssessment().company,
        description: "Commercial law firm advising construction suppliers and title companies.",
        industries: ["Legal Services"],
        businessType: "Law firm",
        canonicalDomain: "",
        website: "",
        companyProfileFound: false,
        corroboratedIdentity: false,
        sourceConfidence: 0.2
      },
      normalized: {
        ...makeAssessment().normalized,
        email: "owner@gmail.com",
        emailLower: "owner@gmail.com",
        emailDomain: "gmail.com",
        genericEmailDomain: true
      },
      locationContext: {
        ...makeAssessment().locationContext,
        available: false,
        summary: "",
        hasStrongHousingSignal: false
      }
    })
  );

  assert.equal(scored.recommendedStatus, "NEEDS_REVIEW");
  assert.ok(scored.score < 60);
  assert.ok(scored.negativeSignals.some((signal) => signal.includes("unrelated")));
});

test("scoreLead treats broad real estate services firms as conditional fit", () => {
  const scored = scoreLead(
    makeAssessment({
      normalized: {
        ...makeAssessment().normalized,
        name: "Michael Lee",
        email: "michael.lee@cushwake.com",
        emailLower: "michael.lee@cushwake.com",
        emailDomain: "cushwake.com",
        company: "Cushman & Wakefield"
      },
      company: {
        ...makeAssessment().company,
        legalName: "Cushman & Wakefield",
        canonicalDomain: "cushwake.com",
        website: "https://www.cushmanwakefield.com",
        description: "Global commercial real estate services firm providing brokerage, facilities management, valuations, and capital markets advisory.",
        industries: ["Commercial Real Estate", "Real Estate Services"],
        businessType: "Commercial real estate services"
      }
    })
  );

  assert.equal(scored.recommendedStatus, "NEEDS_REVIEW");
  assert.equal(
    scored.fitLabel,
    "Possible fit only if the contact supports residential leasing or resident-facing property operations"
  );
  assert.ok(scored.score < 60);
  assert.match(scored.scoreReason, /company domain and property address were validated/i);
  assert.match(scored.scoreReason, /broad real estate services firm/i);
  assert.ok(scored.negativeSignals.some((signal) => signal.includes("broad real estate services firm")));
});
