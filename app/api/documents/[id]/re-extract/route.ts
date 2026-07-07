import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: document } = await supabase
    .from("documents")
    .select("id, contract_id")
    .eq("id", id)
    .single();

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    await runExtractionPipeline(document.id, document.contract_id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Extraction failed",
      },
      { status: 500 }
    );
  }
}
