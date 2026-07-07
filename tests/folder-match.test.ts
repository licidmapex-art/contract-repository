import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFolderPathOptions,
  findBestFolderPathMatch,
  folderExtractionConfirmed,
  normalizeFolderExtraction,
} from "../lib/folders/match";

const folders = [
  { id: "gas", name: "Natural gas", parent_id: null },
  { id: "eu", name: "EU", parent_id: "gas" },
  { id: "h2", name: "Hydrogen", parent_id: null },
];

test("findBestFolderPathMatch prefers full folder paths", () => {
  const options = buildFolderPathOptions(folders);
  const match = findBestFolderPathMatch("Natural gas / EU", options);
  assert.equal(match?.id, "eu");
});

test("normalizeFolderExtraction maps AI value to known folder path", () => {
  const result = normalizeFolderExtraction(
    [
      {
        key: "activity_folder",
        value: "hydrogen",
        confidence: 0.95,
        evidence_page: null,
        evidence_text: null,
      },
    ],
    folders
  );

  assert.equal(result[0].value, "Hydrogen");
});

test("folderExtractionConfirmed requires 90 percent confidence", () => {
  assert.equal(folderExtractionConfirmed(0.89), false);
  assert.equal(folderExtractionConfirmed(0.9), true);
});
