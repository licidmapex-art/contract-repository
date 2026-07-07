import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: document } = await supabase
    .from("documents")
    .select("storage_path, original_filename")
    .eq("id", id)
    .single();

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("contracts")
    .download(document.storage_path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to download file" },
      { status: 500 }
    );
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const filename = document.original_filename.replace(/[^\w.\-]/g, "_");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
