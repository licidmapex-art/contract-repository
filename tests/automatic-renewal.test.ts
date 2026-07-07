import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatAutomaticRenewal,
  parseAutomaticRenewal,
  serializeAutomaticRenewal,
} from "../lib/contracts/automatic-renewal";
import { normalizeAutomaticRenewalExtraction } from "../lib/contracts/automatic-renewal-extract";
import { computeEffectiveStatusFromMetadata } from "../lib/contracts/status";

test("parseAutomaticRenewal handles yes/no variants", () => {
  assert.equal(parseAutomaticRenewal("yes"), true);
  assert.equal(parseAutomaticRenewal("false"), false);
  assert.equal(parseAutomaticRenewal(""), null);
});

test("computeEffectiveStatusFromMetadata uses automatic renewal", () => {
  const status = computeEffectiveStatusFromMetadata(
    "active",
    [
      {
        metadata_fields: { key: "expiry_date" },
        value: "2026-08-01",
      },
      {
        metadata_fields: { key: "automatic_renewal" },
        value: "true",
      },
    ],
    new Date("2026-07-06")
  );

  assert.equal(status, "upcoming_renewal");
});

test("normalizeAutomaticRenewalExtraction coerces values", () => {
  const result = normalizeAutomaticRenewalExtraction([
    {
      key: "automatic_renewal",
      value: "yes",
      confidence: 0.9,
      evidence_page: null,
      evidence_text: null,
    },
  ]);

  assert.equal(result[0].value, serializeAutomaticRenewal(true));
  assert.equal(formatAutomaticRenewal(parseAutomaticRenewal(result[0].value)), "Yes — automatic renewal");
});
