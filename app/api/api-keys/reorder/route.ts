import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { reorderGeminiApiKeys } from "@/lib/gemini/keys";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const body = await request.json();
  const orderedIds =
    (body.orderedIds as string[] | undefined)?.filter(Boolean) ?? [];

  if (!orderedIds.length) {
    return NextResponse.json({ error: "orderedIds is required" }, { status: 400 });
  }

  try {
    await reorderGeminiApiKeys(orderedIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reorder API keys";
    const status = message.includes("orderedIds") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
