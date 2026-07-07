import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { deleteFolder, moveFolder } from "@/lib/folders/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json();
  const parentId =
    body.parentId === null || body.parentId === undefined
      ? null
      : String(body.parentId);

  try {
    const folder = await moveFolder(id, parentId);
    return NextResponse.json({ folder });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to move folder";
    const status =
      message.includes("not found") ? 404
      : message.includes("cannot") || message.includes("already exists") ? 409
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { id } = await params;

  try {
    await deleteFolder(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete folder";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
