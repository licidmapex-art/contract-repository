import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeEffectiveStatus } from "../lib/contracts/status";
import {
  applyNamingTemplate,
  formatDateForFilename,
  resolveCollision,
} from "../lib/naming/apply-template";
import {
  applyStructuredFilters,
  matchesFieldFilters,
  matchesStatusFilter,
} from "../lib/filters/build-query";

describe("computeEffectiveStatus", () => {
  const ref = new Date("2026-07-06");

  it("returns inactive when contract is inactive", () => {
    assert.equal(computeEffectiveStatus("inactive", "2027-01-01", ref), "inactive");
  });

  it("returns active when no expiry date", () => {
    assert.equal(computeEffectiveStatus("active", null, ref), "active");
  });

  it("returns expired when past expiry", () => {
    assert.equal(computeEffectiveStatus("active", "2026-01-01", ref), "expired");
  });

  it("returns expiring within 60 days", () => {
    assert.equal(computeEffectiveStatus("active", "2026-08-01", ref), "expiring");
  });

  it("returns upcoming_renewal when auto-renewal and within 60 days", () => {
    assert.equal(
      computeEffectiveStatus("active", "2026-08-01", ref, true),
      "upcoming_renewal"
    );
  });

  it("returns active when expiry beyond 60 days", () => {
    assert.equal(computeEffectiveStatus("active", "2027-01-01", ref), "active");
  });
});

describe("applyNamingTemplate", () => {
  it("substitutes metadata tokens and role", () => {
    const result = applyNamingTemplate(
      "{contract_type}_{counterparty}_{effective_date}_{document_role}",
      {
        contract_type: "MSA",
        counterparty: "Acme Corp",
        effective_date: "2025-01-15",
      },
      "original"
    );
    assert.equal(result, "Msa-Acme Corp-15 January 2025-Original");
  });

  it("handles missing values as unknown", () => {
    const result = applyNamingTemplate("{counterparty}", {}, "annex");
    assert.equal(result, "Unknown");
  });

  it("normalizes non-ISO dates in filenames", () => {
    const result = applyNamingTemplate(
      "{contract_type}_{effective_date}",
      { contract_type: "MSA", effective_date: "15/01/2025" },
      "original"
    );
    assert.equal(result, "Msa-15 January 2025");
  });

  it("preserves spaces from the template", () => {
    const result = applyNamingTemplate(
      "{contract_type} {counterparty}",
      { contract_type: "NDA", counterparty: "Fluxys SA" },
      "original"
    );
    assert.equal(result, "Nda Fluxys Sa");
  });
});

describe("formatDateForFilename", () => {
  it("parses European date format", () => {
    assert.equal(formatDateForFilename("20/04/2025"), "20 April 2025");
  });

  it("parses written month dates", () => {
    assert.equal(formatDateForFilename("24 September 2025"), "24 September 2025");
    assert.equal(formatDateForFilename("September 24, 2025"), "24 September 2025");
  });
});

describe("resolveCollision", () => {
  it("returns base name when unique", () => {
    assert.equal(resolveCollision("foo", ["bar"]), "foo");
  });

  it("appends suffix on collision", () => {
    assert.equal(resolveCollision("foo", ["foo"]), "foo (2)");
    assert.equal(resolveCollision("foo", ["foo", "foo (2)"]), "foo (3)");
  });
});

describe("filters", () => {
  const sample = [
    {
      id: "1",
      status: "active" as const,
      metadata_values: [
        {
          metadata_fields: { key: "counterparty" },
          value: "Acme Corp",
        },
        {
          metadata_fields: { key: "expiry_date" },
          value: "2026-08-01",
        },
      ],
    },
  ];

  it("matches field filters case-insensitively", () => {
    assert.equal(
      matchesFieldFilters(sample[0].metadata_values, { counterparty: "acme" }),
      true
    );
    assert.equal(
      matchesFieldFilters(sample[0].metadata_values, { counterparty: "Other" }),
      false
    );
  });

  it("matches status filter", () => {
    assert.equal(matchesStatusFilter("expiring", ["expiring", "active"]), true);
    assert.equal(matchesStatusFilter("active", ["expired"]), false);
  });

  it("applies structured date filters", () => {
    const result = applyStructuredFilters(sample, [
      { field: "expiry_date", op: "<=", value: "2026-12-31" },
    ]);
    assert.equal(result.length, 1);
  });
});
