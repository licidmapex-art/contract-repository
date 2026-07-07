import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatNoticePeriod,
  normalizeNoticePeriodExtraction,
  parseNoticePeriod,
  serializeNoticePeriod,
} from "../lib/contracts/notice-period";

test("parseNoticePeriod converts legacy numeric days", () => {
  const period = parseNoticePeriod("90");
  assert.equal(period?.amount, 90);
  assert.equal(period?.unit, "days");
  assert.equal(period?.purpose, "any_time");
});

test("parseNoticePeriod reads structured JSON", () => {
  const period = parseNoticePeriod(
    JSON.stringify({
      amount: 3,
      unit: "months",
      unit_label: "calendar months",
      purpose: "avoid_auto_renewal",
      purpose_detail: null,
    })
  );

  assert.equal(period?.amount, 3);
  assert.equal(period?.unit, "months");
  assert.equal(period?.purpose, "avoid_auto_renewal");
});

test("formatNoticePeriod includes duration and purpose", () => {
  const text = formatNoticePeriod({
    amount: 30,
    unit: "business_days",
    unit_label: null,
    purpose: "avoid_auto_termination",
    purpose_detail: null,
  });

  assert.match(text, /30 business days/i);
  assert.match(text, /automatic termination/i);
});

test("normalizeNoticePeriodExtraction serializes AI output", () => {
  const result = normalizeNoticePeriodExtraction([
    {
      key: "notice_period_days",
      value: JSON.stringify({
        amount: 6,
        unit: "weeks",
        purpose: "any_time",
      }),
      confidence: 0.95,
      evidence_page: 2,
      evidence_text: "six weeks notice",
    },
  ]);

  assert.equal(result[0].key, "notice_period");
  const parsed = parseNoticePeriod(result[0].value);
  assert.equal(parsed?.amount, 6);
  assert.equal(parsed?.unit, "weeks");
});

test("serializeNoticePeriod returns null for empty data", () => {
  assert.equal(
    serializeNoticePeriod({
      amount: null,
      unit: "other",
      unit_label: null,
      purpose: "other",
      purpose_detail: null,
    }),
    null
  );
});
