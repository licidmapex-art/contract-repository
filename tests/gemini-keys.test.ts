import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isGeminiQuotaError,
  parseGeminiApiKeysFromEnv,
} from "../lib/gemini/config";

test("parseGeminiApiKeysFromEnv reads single and multiple keys", () => {
  const keys = parseGeminiApiKeysFromEnv({
    GEMINI_API_KEY: "key-one",
    GEMINI_API_KEYS: "key-two,key-three\nkey-four",
  });

  assert.deepEqual(keys, ["key-one", "key-two", "key-three", "key-four"]);
});

test("parseGeminiApiKeysFromEnv deduplicates keys", () => {
  const keys = parseGeminiApiKeysFromEnv({
    GEMINI_API_KEY: "same",
    GEMINI_API_KEYS: "same,other",
  });

  assert.deepEqual(keys, ["same", "other"]);
});

test("isGeminiQuotaError detects quota and rate limit messages", () => {
  assert.equal(isGeminiQuotaError("429 Too Many Requests"), true);
  assert.equal(
    isGeminiQuotaError("You exceeded your current quota, please check your plan"),
    true
  );
  assert.equal(isGeminiQuotaError("Invalid API key"), false);
});
