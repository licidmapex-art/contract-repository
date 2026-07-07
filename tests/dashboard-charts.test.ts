import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateReviewScores,
  classifyReviewAction,
  computeExpiringByMonth,
} from "../lib/dashboard/charts";

test("classifyReviewAction distinguishes confirm vs correct", () => {
  assert.equal(classifyReviewAction("Acme Corp", "Acme Corp"), "confirm");
  assert.equal(classifyReviewAction("Acme Corp", "ACME Corp"), "correct");
  assert.equal(classifyReviewAction(null, "New value"), "correct");
});

test("aggregateReviewScores sums points per user", () => {
  const scores = aggregateReviewScores([
    {
      user_id: "u1",
      user_email: "alice@example.com",
      action: "confirm",
      points: 1,
    },
    {
      user_id: "u1",
      user_email: "alice@example.com",
      action: "correct",
      points: 5,
    },
    {
      user_id: "u2",
      user_email: "bob@example.com",
      action: "correct",
      points: 5,
    },
  ]);

  assert.equal(scores.length, 2);
  assert.equal(scores[0].userEmail, "alice@example.com");
  assert.equal(scores[0].score, 6);
  assert.equal(scores[0].confirmCount, 1);
  assert.equal(scores[0].correctCount, 1);
});

test("computeExpiringByMonth buckets contracts in next three months", () => {
  const reference = new Date("2025-07-15");
  const rows = computeExpiringByMonth(
    [
      {
        metadata_values: [
          {
            metadata_fields: { key: "expiry_date" },
            value: "2025-08-10",
          },
        ],
      },
      {
        metadata_values: [
          {
            metadata_fields: { key: "expiry_date" },
            value: "2025-08-20",
          },
        ],
      },
      {
        metadata_values: [
          {
            metadata_fields: { key: "expiry_date" },
            value: "2026-01-01",
          },
        ],
      },
    ],
    reference,
    3
  );

  assert.equal(rows.length, 3);
  assert.equal(rows[0].label, "July 2025");
  assert.equal(rows[1].count, 2);
  assert.equal(rows[2].count, 0);
});
