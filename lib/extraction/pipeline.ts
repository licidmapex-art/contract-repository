import { createAdminClient } from "@/lib/supabase/admin";
import { extractMetadataFields } from "@/lib/gemini/extract";
import { extractPdfTextDetailed } from "@/lib/pdf/extract-text";
import { CONFIDENCE_THRESHOLD } from "@/lib/types";
import { linkContractParties } from "@/lib/entities/link-contract";
import { linkContractType } from "@/lib/entities/link-contract-type";
import { normalizeContractTypeExtraction } from "@/lib/entities/contract-type";
import { adjustPartyFields } from "@/lib/entities/match";
import { fetchAllFolders } from "@/lib/folders/db";
import { linkContractFolder } from "@/lib/folders/link-contract-folder";
import {
  buildFolderPathOptions,
  FOLDER_CONFIDENCE_THRESHOLD,
  normalizeFolderExtraction,
} from "@/lib/folders/match";
import { normalizeNoticePeriodExtraction } from "@/lib/contracts/notice-period";
import { normalizeAutomaticRenewalExtraction } from "@/lib/contracts/automatic-renewal-extract";

export async function runExtractionPipeline(
  documentId: string,
  contractId: string
): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from("documents")
    .update({ processing_status: "processing" })
    .eq("id", documentId);

  try {
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      throw new Error(docError?.message ?? "Document not found");
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("contracts")
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error(downloadError?.message ?? "Failed to download file");
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const { text: extractedText, source } = await extractPdfTextDetailed(buffer);

    if (source === "ocr") {
      console.info(`Document ${documentId}: text extracted via OCR`);
    }

    await supabase
      .from("documents")
      .update({ extracted_text: extractedText })
      .eq("id", documentId);

    const { data: fields } = await supabase
      .from("metadata_fields")
      .select("*");

    const [{ data: legalEntities }, { data: counterparties }, { data: contractTypes }, folders] =
      await Promise.all([
        supabase.from("legal_entities").select("id, name").order("name"),
        supabase.from("counterparties").select("id, name").order("name"),
        supabase.from("contract_types").select("id, name").order("name"),
        fetchAllFolders(),
      ]);

    const folderPaths = buildFolderPathOptions(folders).map((option) => option.path);

    if (!fields?.length) {
      await supabase
        .from("documents")
        .update({ processing_status: "complete" })
        .eq("id", documentId);
      return;
    }

    let extracted =
      extractedText.length > 0
        ? await extractMetadataFields(fields, extractedText, {
            legalEntityNames: (legalEntities ?? []).map((e) => e.name),
            contractTypeNames: (contractTypes ?? []).map((t) => t.name),
            folderPaths,
          })
        : fields.map((f) => ({
            key: f.key,
            value: null,
            confidence: 0,
            evidence_page: null,
            evidence_text: null,
          }));

    extracted = adjustPartyFields(
      extracted,
      legalEntities ?? [],
      counterparties ?? []
    );

    extracted = normalizeContractTypeExtraction(
      extracted,
      contractTypes ?? []
    );

    extracted = normalizeFolderExtraction(extracted, folders);
    extracted = normalizeNoticePeriodExtraction(extracted);
    extracted = normalizeAutomaticRenewalExtraction(extracted);

    for (const item of extracted) {
      const field = fields.find((f) => f.key === item.key);
      if (!field) continue;

      const threshold =
        item.key === "activity_folder"
          ? FOLDER_CONFIDENCE_THRESHOLD
          : CONFIDENCE_THRESHOLD;
      const confirmed =
        item.confidence >= threshold && item.value !== null;

      await supabase.from("metadata_values").upsert(
        {
          contract_id: contractId,
          field_id: field.id,
          value: item.value,
          confidence: item.confidence,
          confirmed,
          source_document_id: documentId,
          evidence_page: item.evidence_page,
          evidence_text: item.evidence_text,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "contract_id,field_id" }
      );
    }

    await linkContractParties(contractId, extracted);
    await linkContractType(contractId, extracted);
    await linkContractFolder(contractId, extracted);

    const legalEntity = extracted.find((e) => e.key === "legal_entity")?.value;
    const counterparty = extracted.find((e) => e.key === "counterparty")?.value;
    const contractType = extracted.find((e) => e.key === "contract_type")?.value;

    const title =
      legalEntity && counterparty
        ? `${legalEntity} / ${counterparty}`
        : counterparty ?? legalEntity ?? contractType ?? null;

    if (title) {
      await supabase.from("contracts").update({ title }).eq("id", contractId);
    }

    await supabase
      .from("documents")
      .update({ processing_status: "complete" })
      .eq("id", documentId);
  } catch (error) {
    console.error("Extraction pipeline failed:", error);
    await supabase
      .from("documents")
      .update({ processing_status: "failed" })
      .eq("id", documentId);
    throw error;
  }
}
