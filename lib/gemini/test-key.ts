import { GoogleGenerativeAI } from "@google/generative-ai";
import { isGeminiQuotaError } from "@/lib/gemini/config";
import type { ApiKeyTestStatus } from "@/lib/types";

export type ApiKeyTestResult = {
  status: ApiKeyTestStatus;
  message: string;
};

export async function testGeminiApiKey(
  apiKey: string,
  modelName: string
): Promise<ApiKeyTestResult> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { status: "invalid", message: "API key is empty" };
  }

  const genAI = new GoogleGenerativeAI(trimmed);
  const model = genAI.getGenerativeModel({ model: modelName });

  try {
    const result = await model.generateContent("Reply with exactly: OK");
    const text = result.response.text().trim();
    if (!text) {
      return {
        status: "error",
        message: "Key responded but returned no text",
      };
    }

    return {
      status: "ok",
      message: "Key is valid and has available quota.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (/api key not valid|invalid api key|permission denied|401|403/i.test(message)) {
      return { status: "invalid", message };
    }

    if (isGeminiQuotaError(message)) {
      return {
        status: "quota_exceeded",
        message: "Free-tier quota exhausted for this key. The next key in the list will be used automatically.",
      };
    }

    return { status: "error", message };
  }
}
