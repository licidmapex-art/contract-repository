import { createAdminClient } from "@/lib/supabase/admin";
import { extractMetadataFields } from "@/lib/gemini/extract";
import { normalizeContractTypeExtraction } from "@/lib/entities/contract-type";
import { linkContractType } from "@/lib/entities/link-contract-type";
import { fetchAllFolders } from "@/lib/folders/db";
import { linkContractFolder } from "@/lib/folders/link-contract-folder";
import {
  buildFolderPathOptions,
  FOLDER_CONFIDENCE_THRESHOLD,
  normalizeFolderExtraction,
} from "@/lib/folders/match";
import { normalizeNoticePeriodExtraction } from "@/lib/contracts/notice-period";
import { normalizeAutomaticRenewalExtraction } from "@/lib/contracts/automatic-renewal-extract";
import { CONFIDENCE_THRESHOLD } from "@/lib/types";

export async function reExtractFieldAcrossContracts(
  fieldId: string
): Promise<{ processed: number }> {
  const supabase = createAdminClient();

  const { data: field } = await supabase
    .from("metadata_fields")
    .select("*")
    .eq("id", fieldId)
    .single();

  if (!field) throw new Error("Field not found");

  const { data: contracts } = await supabase.from("contracts").select("id");
  if (!contracts?.length) return { processed: 0 };

  let processed = 0;

  const { data: contractTypes } = await supabase
    .from("contract_types")
    .select("id, name")
    .order("name");

  const { data: legalEntities } =
    field.key === "legal_entity" || field.key === "counterparty"
      ? await supabase.from("legal_entities").select("name").order("name")
      : { data: null };

  const legalEntityNames = legalEntities?.map((e) => e.name);
  const contractTypeNames = contractTypes?.map((t) => t.name);
  const folders =
    field.key === "activity_folder" ? await fetchAllFolders() : [];
  const folderPaths =
    field.key === "activity_folder"
      ? buildFolderPathOptions(folders).map((option) => option.path)
      : undefined;

  for (const contract of contracts) {
    const { data: documents } = await supabase
      .from("documents")
      .select("id, extracted_text")
      .eq("contract_id", contract.id)
      .not("extracted_text", "is", null)
      .order("created_at")
      .limit(1);

    const doc = documents?.[0];
    if (!doc?.extracted_text) continue;

    let extracted = await extractMetadataFields([field], doc.extracted_text, {
      contractTypeNames:
        field.key === "contract_type" ? contractTypeNames : undefined,
      legalEntityNames:
        field.key === "legal_entity" || field.key === "counterparty"
          ? legalEntityNames
          : undefined,
      folderPaths,
    });

    if (field.key === "contract_type") {
      extracted = normalizeContractTypeExtraction(
        extracted,
        contractTypes ?? []
      );
    }

    if (field.key === "activity_folder") {
      extracted = normalizeFolderExtraction(extracted, folders);
    }

    extracted = normalizeNoticePeriodExtraction(extracted);
    extracted = normalizeAutomaticRenewalExtraction(extracted);

    const item = extracted[0];
    if (!item) continue;

    const threshold =
      field.key === "activity_folder"
        ? FOLDER_CONFIDENCE_THRESHOLD
        : CONFIDENCE_THRESHOLD;
    const confirmed =
      item.confidence >= threshold && item.value !== null;

    await supabase.from("metadata_values").upsert(
      {
        contract_id: contract.id,
        field_id: fieldId,
        value: item.value,
        confidence: item.confidence,
        confirmed,
        source_document_id: doc.id,
        evidence_page: item.evidence_page,
        evidence_text: item.evidence_text,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "contract_id,field_id" }
    );

    if (field.key === "contract_type") {
      await linkContractType(contract.id, extracted);
    }

    if (field.key === "activity_folder") {
      await linkContractFolder(contract.id, extracted);
    }

    processed++;
  }

  return { processed };
}
