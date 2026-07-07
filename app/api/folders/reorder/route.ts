import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { reorderFolders } from "@/lib/folders/db";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const body = await request.json();
  const parentId =
    body.parentId === null || body.parentId === undefined
      ? null
      : String(body.parentId);
  const orderedIds = (body.orderedIds as string[] | undefined)?.filter(Boolean) ?? [];

  if (!orderedIds.length) {
    return NextResponse.json({ error: "orderedIds is required" }, { status: 400 });
  }

  try {
    await reorderFolders(parentId, orderedIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reorder folders";
    const status = message.includes("siblings") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
