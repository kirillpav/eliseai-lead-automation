import assert from "node:assert/strict";
import test from "node:test";

import { normalizeLead } from "../src/normalization.js";

test("normalizeLead trims fields, lowercases email, and extracts domain", () => {
  const normalized = normalizeLead({
    name: "  Sarah Chen  ",
    email: "  Sarah@AcmeProperty.com ",
    company: "  Acme Property Group ",
    propertyAddress: " 123 Main St ",
    city: " Dallas ",
    state: " TX ",
    country: " United States "
  });

  assert.equal(normalized.name, "Sarah Chen");
  assert.equal(normalized.email, "sarah@acmeproperty.com");
  assert.equal(normalized.emailDomain, "acmeproperty.com");
  assert.equal(normalized.genericEmailDomain, false);
  assert.equal(normalized.fullAddress, "123 Main St, Dallas, TX, United States");
  assert.equal(normalized.hasRequiredFields, true);
});

test("normalizeLead flags missing critical fields and generic email domains", () => {
  const normalized = normalizeLead({
    name: "",
    email: "owner@gmail.com",
    company: "",
    propertyAddress: "",
    city: "Austin",
    state: "",
    country: ""
  });

  assert.equal(normalized.genericEmailDomain, true);
  assert.equal(normalized.emailDomain, "gmail.com");
  assert.equal(normalized.hasRequiredFields, false);
  assert.deepEqual(normalized.missingCriticalFields, [
    "name",
    "company",
    "property address",
    "country"
  ]);
});
