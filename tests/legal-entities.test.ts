import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseLegalEntitiesExcel } from "../lib/excel/parse-legal-entities";

test("parseLegalEntitiesExcel reads header row", () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Name", "Country", "VAT number"],
    ["Acme GmbH", "Germany", "DE123"],
    ["Beta Ltd", "UK", "GB456"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Entities");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const entities = parseLegalEntitiesExcel(buffer);

  assert.equal(entities.length, 2);
  assert.equal(entities[0].name, "Acme GmbH");
  assert.equal(entities[0].country, "Germany");
  assert.equal(entities[0].vat_number, "DE123");
});

test("parseLegalEntitiesExcel reads positional columns without headers", () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Gamma Inc", "US-123", "USA", "US-VAT", "HQ notes"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const entities = parseLegalEntitiesExcel(buffer);

  assert.equal(entities.length, 1);
  assert.equal(entities[0].name, "Gamma Inc");
  assert.equal(entities[0].registration_number, "US-123");
  assert.equal(entities[0].notes, "HQ notes");
});
