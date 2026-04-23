import assert from "node:assert/strict";
import test from "node:test";

import { buildLeadPreviewPayload } from "../src/analytics.js";
import { prepareLeadPreviewForInsert, validateLeadPreviewPayload } from "../web/lib/lead-preview.js";

test("buildLeadPreviewPayload captures mirrored sheet state", () => {
  const payload = buildLeadPreviewPayload({
    timestamp: "2026-04-23T19:00:00.000Z",
    runId: "lead-row-8-123",
    leadRowNumber: 8,
    processingStatus: "ENRICHED",
    input: {
      name: "Sarah Chen",
      email: "sarah@acmeproperty.com",
      company: "Acme Property Group",
      propertyAddress: "123 Main St",
      city: "Dallas",
      state: "TX",
      country: "United States"
    },
    normalized: {
      fullAddress: "123 Main St, Dallas, TX, United States"
    } as never,
    assessment: {
      normalized: {
        name: "Sarah Chen"
      },
      company: {
        canonicalDomain: "acmeproperty.com"
      },
      address: {
        formattedAddress: "123 Main St, Dallas, TX 75201"
      },
      locationContext: {
        summary: "renter share is 61.2%"
      }
    } as never,
    scoredLead: {
      score: 90,
      tier: "HOT"
    } as never,
    repOutputs: {
      salesInsights: "fit • confidence • priority",
      draftOutreachEmail: "Hi Sarah"
    } as never,
    rowOutput: {
      "Lead Score": 90,
      "Lead Tier": "HOT",
      "Lead Score Reason": "Strong multifamily fit",
      "Sales Insights": "fit • confidence • priority",
      "Why Prioritize": "Validated operator",
      "What's Missing": "No major gaps",
      "Draft Outreach Email": "Hi Sarah",
      Status: "ENRICHED",
      "Last Processed At": "2026-04-23T19:00:00.000Z"
    } as never
  });

  assert.equal(payload.processingStatus, "ENRICHED");
  assert.equal(payload.leadRowNumber, 8);
  assert.deepEqual(payload.input, {
    name: "Sarah Chen",
    email: "sarah@acmeproperty.com",
    company: "Acme Property Group",
    propertyAddress: "123 Main St",
    city: "Dallas",
    state: "TX",
    country: "United States"
  });
});

test("validateLeadPreviewPayload and prepareLeadPreviewForInsert extract lead summary fields", () => {
  const validated = validateLeadPreviewPayload({
    timestamp: "2026-04-23T19:00:00.000Z",
    source: "apps-script",
    runId: "lead-row-4-999",
    leadRowNumber: 4,
    processingStatus: "NEEDS_REVIEW",
    errorMessage: "",
    input: {
      name: "Michael Lee",
      email: "michael@acme.com",
      company: "Acme Residential",
      propertyAddress: "42 Park Ave"
    },
    normalized: {
      fullAddress: "42 Park Ave, Austin, TX, United States"
    },
    company: {
      canonicalDomain: "acme.com"
    },
    address: {
      formattedAddress: "42 Park Ave, Austin, TX"
    },
    locationContext: {
      summary: "dense renter corridor"
    },
    scoredLead: {
      score: 61,
      tier: "WARM"
    },
    repOutputs: {
      salesInsights: "possible fit • moderate confidence • review soon",
      draftOutreachEmail: "Hi Michael"
    },
    rowOutput: {
      "Lead Score": 61,
      "Lead Tier": "WARM",
      "Lead Score Reason": "Needs more operator confirmation",
      "Sales Insights": "possible fit • moderate confidence • review soon",
      "Why Prioritize": "Potential residential operator",
      "What's Missing": "Verified company profile",
      "Draft Outreach Email": "Hi Michael"
    }
  });

  assert.equal(validated.ok, true);
  if (!validated.ok) {
    return;
  }

  const record = prepareLeadPreviewForInsert(validated.value);
  assert.equal(record.leadName, "Michael Lee");
  assert.equal(record.leadCompany, "Acme Residential");
  assert.equal(record.leadScore, 61);
  assert.equal(record.processingStatus, "NEEDS_REVIEW");
  assert.equal(record.salesInsights, "possible fit • moderate confidence • review soon");
});

test("validateLeadPreviewPayload rejects malformed lead payloads", () => {
  const result = validateLeadPreviewPayload({
    timestamp: "2026-04-23T19:00:00.000Z",
    source: "apps-script",
    runId: "",
    leadRowNumber: "4",
    processingStatus: "",
    input: null
  });

  assert.equal(result.ok, false);
});
