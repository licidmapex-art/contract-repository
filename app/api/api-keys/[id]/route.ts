import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { deleteGeminiApiKey, updateGeminiApiKey } from "@/lib/gemini/keys";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const body = await request.json();

  try {
    const key = await updateGeminiApiKey(id, {
      label: typeof body.label === "string" ? body.label : undefined,
      api_key: typeof body.api_key === "string" ? body.api_key : undefined,
    });
    return NextResponse.json({ key });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update API key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { id } = await context.params;

  try {
    await deleteGeminiApiKey(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete API key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
