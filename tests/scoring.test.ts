import assert from "node:assert/strict";
import test from "node:test";

import { buildActionabilityOutputs, buildFallbackRepOutputs } from "../src/rep-output.js";
import { deriveLeadTier, scoreLead } from "../src/scoring.js";
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
      housingSignalLevel: "high",
      highRenterShare: true,
      largeHousingUnitBase: true,
      premiumRentMarket: true,
      housingSignalTags: ["high renter share", "large housing-unit base"],
      housingContextTags: ["high renter share", "large housing-unit base", "premium rent market"],
      hasStrongHousingSignal: true
    },
    ...overrides
  };
}

test("scoreLead rewards strong multifamily and validated data signals", () => {
  const scored = scoreLead(makeAssessment());

  assert.equal(scored.recommendedStatus, "ENRICHED");
  assert.equal(scored.score, 90);
  assert.equal(scored.tier, "HOT");
  assert.match(scored.fitLabel, /Strong multifamily/);
  assert.ok(scored.positiveSignals.some((signal) => signal.includes("multifamily")));
  assert.ok(scored.positiveSignals.some((signal) => signal.includes("exceptional signal quality")));
  assert.ok(scored.positiveSignals.some((signal) => signal.includes("high renter share")));
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
        housingSignalLevel: "unknown",
        highRenterShare: false,
        largeHousingUnitBase: false,
        premiumRentMarket: false,
        housingSignalTags: [],
        housingContextTags: [],
        hasStrongHousingSignal: false
      }
    })
  );

  assert.equal(scored.recommendedStatus, "NEEDS_REVIEW");
  assert.ok(scored.score < 60);
  assert.ok(scored.negativeSignals.some((signal) => signal.includes("unrelated")));
});

test("scoreLead treats premium rent as context, not a housing score signal", () => {
  const scored = scoreLead(
    makeAssessment({
      locationContext: {
        ...makeAssessment().locationContext,
        summary: "renter share is 30.0%, 1,200 housing units, median gross rent is $2,400",
        renterOccupiedPct: 30,
        housingUnits: 1200,
        medianGrossRent: 2400,
        housingSignalLevel: "low",
        highRenterShare: false,
        largeHousingUnitBase: false,
        premiumRentMarket: true,
        housingSignalTags: [],
        housingContextTags: ["premium rent market"],
        hasStrongHousingSignal: false
      }
    })
  );

  assert.ok(!scored.positiveSignals.some((signal) => signal.includes("Census housing context")));
});

test("scoreLead enriches strong outreach-ready leads even when address validation is unavailable", () => {
  const scored = scoreLead(
    makeAssessment({
      address: {
        ...makeAssessment().address,
        formattedAddress: "1700 California Street, San Francisco, CA, United States",
        latitude: null,
        longitude: null,
        postcode: "",
        confidence: 0,
        cityConfidence: 0,
        streetConfidence: 0,
        buildingConfidence: 0,
        matchType: "",
        isValid: false,
        isComplete: false
      },
      locationContext: {
        ...makeAssessment().locationContext,
        available: false,
        summary: "",
        housingSignalLevel: "unknown",
        highRenterShare: false,
        largeHousingUnitBase: false,
        premiumRentMarket: false,
        housingSignalTags: [],
        housingContextTags: [],
        hasStrongHousingSignal: false
      }
    })
  );

  assert.equal(scored.tier, "WARM");
  assert.equal(scored.recommendedStatus, "ENRICHED");
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
  assert.equal(scored.tier, "REVIEW");
  assert.match(scored.scoreReason, /company domain and property address were validated/i);
  assert.match(scored.scoreReason, /commercial-real-estate-oriented/i);
  assert.match(scored.scoreReason, /multifamily or residential/i);
  assert.ok(scored.negativeSignals.some((signal) => signal.includes("broad real estate services firm")));
});

test("deriveLeadTier maps score bands for SDR prioritization", () => {
  assert.equal(deriveLeadTier(92), "HOT");
  assert.equal(deriveLeadTier(80), "HOT");
  assert.equal(deriveLeadTier(79), "WARM");
  assert.equal(deriveLeadTier(55), "WARM");
  assert.equal(deriveLeadTier(54), "REVIEW");
  assert.equal(deriveLeadTier(25), "REVIEW");
  assert.equal(deriveLeadTier(24), "COLD");
  assert.equal(deriveLeadTier(0), "COLD");
});

test("buildActionabilityOutputs highlights why a strong-fit lead should be prioritized", () => {
  const assessment = makeAssessment();
  const scored = scoreLead(assessment);
  const actionability = buildActionabilityOutputs(assessment, scored);

  assert.match(actionability.whyPrioritize, /strong multifamily\/property-operations fit/i);
  assert.match(actionability.whyPrioritize, /validated company identity/i);
  assert.equal(actionability.whatsMissing, "No major gaps; ready for outreach.");
});

test("buildActionabilityOutputs makes review gaps explicit for conditional-fit leads", () => {
  const assessment = makeAssessment({
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
  });
  const scored = scoreLead(assessment);
  const actionability = buildActionabilityOutputs(assessment, scored);

  assert.match(actionability.whyPrioritize, /possible fit only if/i);
  assert.match(actionability.whatsMissing, /confirmation that the contact owns residential leasing or resident operations/i);
});

test("buildFallbackRepOutputs uses direct outreach for HOT enriched leads", () => {
  const assessment = makeAssessment();
  const scored = scoreLead(assessment);
  const outputs = buildFallbackRepOutputs(assessment, scored);

  assert.equal(scored.tier, "HOT");
  assert.equal(scored.recommendedStatus, "ENRICHED");
  assert.match(outputs.draftOutreachEmail, /strong multifamily\/property-operations signal/i);
  assert.match(outputs.draftOutreachEmail, /where your team is seeing the most inbound volume/i);
  assert.doesNotMatch(outputs.draftOutreachEmail, /^If you support/im);
});

test("buildFallbackRepOutputs uses conditional outreach for REVIEW leads", () => {
  const assessment = makeAssessment({
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
  });
  const scored = scoreLead(assessment);
  const outputs = buildFallbackRepOutputs(assessment, scored);

  assert.equal(scored.tier, "REVIEW");
  assert.equal(scored.recommendedStatus, "NEEDS_REVIEW");
  assert.match(outputs.draftOutreachEmail, /not sure whether your team handles residential leasing/i);
  assert.match(outputs.draftOutreachEmail, /worth a quick check/i);
});
