import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseContractTypesExcel } from "../lib/excel/parse-contract-types";

test("parseContractTypesExcel reads header row", () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Name", "Description"],
    ["MSA", "Master services agreement"],
    ["NDA", "Non-disclosure agreement"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Types");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const types = parseContractTypesExcel(buffer);

  assert.equal(types.length, 2);
  assert.equal(types[0].name, "MSA");
  assert.equal(types[0].description, "Master services agreement");
});

test("parseContractTypesExcel reads positional columns without headers", () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["SaaS Agreement", "Cloud subscription", "Standard template"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const types = parseContractTypesExcel(buffer);

  assert.equal(types.length, 1);
  assert.equal(types[0].name, "SaaS Agreement");
  assert.equal(types[0].notes, "Standard template");
});
