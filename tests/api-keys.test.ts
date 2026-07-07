import { test } from "node:test";
import assert from "node:assert/strict";
import { maskApiKey } from "../lib/gemini/keys";
import { testGeminiApiKey } from "../lib/gemini/test-key";

test("maskApiKey hides middle of long keys", () => {
  assert.equal(maskApiKey("AIzaSyAbCdEfGhIjKlMn"), "AIza••••••••••••KlMn");
});

test("maskApiKey masks short keys fully", () => {
  assert.equal(maskApiKey("short"), "••••••••");
});

test("testGeminiApiKey rejects empty keys", async () => {
  const result = await testGeminiApiKey("", "gemini-2.5-flash");
  assert.equal(result.status, "invalid");
});
