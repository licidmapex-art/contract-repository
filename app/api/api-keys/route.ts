import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import {
  createGeminiApiKey,
  getApiKeysMigrationSql,
  getGeminiModelName,
  getSupabaseSqlEditorUrl,
  importEnvGeminiKeysIfEmpty,
  isApiKeysMigrationRequired,
  recordGeminiApiKeyTest,
  setGeminiModelName,
} from "@/lib/gemini/keys";
import { testGeminiApiKey } from "@/lib/gemini/test-key";

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  try {
    const keys = await importEnvGeminiKeysIfEmpty();
    const model = await getGeminiModelName();
    const migrationRequired = await isApiKeysMigrationRequired();
    return NextResponse.json({
      keys,
      model,
      migrationRequired,
      migrationSql: migrationRequired ? getApiKeysMigrationSql() : undefined,
      sqlEditorUrl: migrationRequired ? getSupabaseSqlEditorUrl() : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load API keys";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const body = await request.json();
  const model = body.model;

  if (typeof model !== "string") {
    return NextResponse.json({ error: "model is required" }, { status: 400 });
  }

  try {
    const saved = await setGeminiModelName(model);
    return NextResponse.json({ model: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save model";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const body = await request.json();
  const api_key = typeof body.api_key === "string" ? body.api_key : "";
  const label = typeof body.label === "string" ? body.label : undefined;
  const testOnSave = body.test !== false;

  try {
    const key = await createGeminiApiKey({ api_key, label });

    if (testOnSave) {
      const model = await getGeminiModelName();
      const result = await testGeminiApiKey(api_key, model);
      const updated = await recordGeminiApiKeyTest(key.id, result);
      return NextResponse.json({ key: updated, test: result });
    }

    return NextResponse.json({ key });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add API key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
