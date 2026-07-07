import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";
import { DocumentRole, DOCUMENT_ROLES } from "@/lib/types";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  const formContractId = formData.get("contract_id") as string | null;
  const role = (formData.get("role") as DocumentRole) || "original";

  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  if (!DOCUMENT_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const supabase = createAdminClient();
  let targetContractId = formContractId;

  if (!targetContractId) {
    const { data: contract, error } = await supabase
      .from("contracts")
      .insert({ title: null })
      .select()
      .single();

    if (error || !contract) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create contract" },
        { status: 500 }
      );
    }
    targetContractId = contract.id;
  }

  if (!targetContractId) {
    return NextResponse.json({ error: "No contract ID" }, { status: 500 });
  }

  const resolvedContractId = targetContractId;
  const uploadedDocuments = [];

  for (const file of files) {
    const ext = file.name.split(".").pop() ?? "pdf";
    const storagePath = `${resolvedContractId}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("contracts")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: document, error: docError } = await supabase
      .from("documents")
      .insert({
        contract_id: resolvedContractId,
        role,
        storage_path: storagePath,
        original_filename: file.name,
        processing_status: "pending",
        uploaded_via: "ui",
      })
      .select()
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: docError?.message ?? "Failed to save document" },
        { status: 500 }
      );
    }

    uploadedDocuments.push(document);

    runExtractionPipeline(document.id, resolvedContractId).catch(console.error);
  }

  return NextResponse.json({
    contract_id: resolvedContractId,
    documents: uploadedDocuments,
  });
}
