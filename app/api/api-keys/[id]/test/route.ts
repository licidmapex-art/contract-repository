import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import {
  getGeminiApiKeyValue,
  getGeminiModelName,
  recordGeminiApiKeyTest,
} from "@/lib/gemini/keys";
import { testGeminiApiKey } from "@/lib/gemini/test-key";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { id } = await context.params;

  try {
    const apiKey = await getGeminiApiKeyValue(id);
    const model = await getGeminiModelName();
    const result = await testGeminiApiKey(apiKey, model);
    const key = await recordGeminiApiKeyTest(id, result);
    return NextResponse.json({ key, test: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to test API key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
