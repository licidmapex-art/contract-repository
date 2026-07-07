import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adjustPartyFields,
  findBestEntityMatch,
  nameSimilarity,
  resolvePartiesFromExtraction,
  stripKnownEntities,
} from "../lib/entities/match";

const legalEntities = [{ id: "1", name: "Interconnector Limited" }];
const counterparties = [{ id: "2", name: "FLUXYS S.A." }];

test("nameSimilarity matches minor spelling differences", () => {
  assert.ok(nameSimilarity("Fluxys SA", "FLUXYS S.A.") >= 0.82);
});

test("findBestEntityMatch prefers legal entity from combined string", () => {
  const match = findBestEntityMatch(
    "Interconnector Limited, FLUXYS S.A.",
    legalEntities
  );
  assert.equal(match?.name, "Interconnector Limited");
});

test("resolvePartiesFromExtraction classifies each split party", () => {
  const resolved = resolvePartiesFromExtraction(
    null,
    "Interconnector Limited, FLUXYS S.A.",
    legalEntities,
    counterparties
  );

  assert.equal(resolved.legalEntity?.name, "Interconnector Limited");
  assert.equal(resolved.counterparty?.name, "FLUXYS S.A.");
  assert.equal(resolved.counterpartyDisplayName, "FLUXYS S.A.");
});

test("resolvePartiesFromExtraction fuzzy-matches counterparty variants", () => {
  const resolved = resolvePartiesFromExtraction(
    null,
    "Interconnector Limited, Fluxys SA",
    legalEntities,
    counterparties
  );

  assert.equal(resolved.legalEntity?.name, "Interconnector Limited");
  assert.equal(resolved.counterparty?.name, "FLUXYS S.A.");
});

test("resolvePartiesFromExtraction marks unknown external party for creation", () => {
  const resolved = resolvePartiesFromExtraction(
    null,
    "Interconnector Limited, NewCo GmbH",
    legalEntities,
    counterparties
  );

  assert.equal(resolved.legalEntity?.name, "Interconnector Limited");
  assert.equal(resolved.counterparty, null);
  assert.equal(resolved.counterpartyName, "NewCo GmbH");
});

test("stripKnownEntities removes our legal entity from counterparty text", () => {
  const cleaned = stripKnownEntities("Interconnector Limited, FLUXYS S.A.", [
    "Interconnector Limited",
  ]);
  assert.equal(cleaned, "FLUXYS S.A.");
});

test("adjustPartyFields splits combined extraction into legal entity and counterparty", () => {
  const adjusted = adjustPartyFields(
    [
      { key: "legal_entity", value: null, confidence: 0 },
      {
        key: "counterparty",
        value: "Interconnector Limited, FLUXYS S.A.",
        confidence: 0.9,
      },
    ],
    legalEntities,
    counterparties
  );

  assert.equal(
    adjusted.find((f) => f.key === "legal_entity")?.value,
    "Interconnector Limited"
  );
  assert.equal(
    adjusted.find((f) => f.key === "counterparty")?.value,
    "FLUXYS S.A."
  );
});
