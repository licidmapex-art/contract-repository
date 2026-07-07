import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";

// Phase 2: Gmail polling will call this endpoint.
// For now, accepts manual trigger with base64 PDF attachments.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-ingest-secret");
  if (secret !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { filename, content_base64, role = "original" } = body;

  if (!filename || !content_base64) {
    return NextResponse.json({ error: "Missing attachment data" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: contract } = await supabase
    .from("contracts")
    .insert({ title: null })
    .select()
    .single();

  if (!contract) {
    return NextResponse.json({ error: "Failed to create contract" }, { status: 500 });
  }

  const buffer = Buffer.from(content_base64, "base64");
  const storagePath = `${contract.id}/${crypto.randomUUID()}.pdf`;

  await supabase.storage.from("contracts").upload(storagePath, buffer, {
    contentType: "application/pdf",
  });

  const { data: document } = await supabase
    .from("documents")
    .insert({
      contract_id: contract.id,
      role,
      storage_path: storagePath,
      original_filename: filename,
      processing_status: "pending",
      uploaded_via: "email",
    })
    .select()
    .single();

  if (!document) {
    return NextResponse.json({ error: "Failed to save document" }, { status: 500 });
  }

  await runExtractionPipeline(document.id, contract.id);

  return NextResponse.json({ contract_id: contract.id, document_id: document.id });
}
