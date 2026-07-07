import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHighlightSegments } from "../lib/pdf/search-document";

test("buildHighlightSegments returns only the matched character range", () => {
  const segments = buildHighlightSegments("The Parties signed an NDA on 24 September 2025.", [
    { start: 22, end: 25, isActive: true },
  ]);

  assert.deepEqual(segments, [{ start: 22, end: 25, isActive: true }]);
});
