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
    .select("storage_path")
    .eq("id", id)
    .single();

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("contracts")
    .createSignedUrl(document.storage_path, 3600);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
