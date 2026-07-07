import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { needsOcr } from "../lib/pdf/ocr";

describe("needsOcr", () => {
  it("returns true for empty text", () => {
    assert.equal(needsOcr("", 3), true);
    assert.equal(needsOcr("   ", 1), true);
  });

  it("returns false when enough text per page", () => {
    const text = "word ".repeat(50);
    assert.equal(needsOcr(text, 1), false);
  });

  it("returns true for scanned PDFs with almost no text", () => {
    assert.equal(needsOcr("Page 1", 10), true);
  });
});
