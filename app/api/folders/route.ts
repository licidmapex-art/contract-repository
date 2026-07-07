import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createFolder, fetchAllFolders } from "@/lib/folders/db";

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  try {
    const folders = await fetchAllFolders();
    return NextResponse.json({ folders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load folders";
    const status = message.includes("missing") || message.includes("migration") ? 503 : 500;
    return NextResponse.json({ error: message, folders: [] }, { status });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const body = await request.json();
  const name = body.name?.trim();
  const parentId =
    body.parentId === null || body.parentId === undefined
      ? null
      : String(body.parentId);

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const folder = await createFolder(name, parentId);
    return NextResponse.json({ folder });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create folder";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
