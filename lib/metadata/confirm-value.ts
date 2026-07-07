import { createAdminClient } from "@/lib/supabase/admin";
import { applyFolderFromMetadataValue } from "@/lib/folders/link-contract-folder";
import { logMetadataReviewEvent } from "@/lib/review/log-event";
import { MetadataValue } from "@/lib/types";

export async function confirmMetadataValue(params: {
  contractId: string;
  fieldId: string;
  value: string | null;
  userId: string;
  userEmail: string | null;
  skipFolderSideEffect?: boolean;
}): Promise<MetadataValue> {
  const {
    contractId,
    fieldId,
    value,
    userId,
    userEmail,
    skipFolderSideEffect,
  } = params;
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("metadata_values")
    .select("value")
    .eq("contract_id", contractId)
    .eq("field_id", fieldId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("metadata_values")
    .upsert(
      {
        contract_id: contractId,
        field_id: fieldId,
        value,
        confidence: null,
        confirmed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "contract_id,field_id" }
    )
    .select("*, metadata_fields(*)")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logMetadataReviewEvent({
    userId,
    userEmail,
    contractId,
    fieldId,
    previousValue: existing?.value ?? null,
    submittedValue: value,
  });

  if (data.metadata_fields?.key === "activity_folder" && !skipFolderSideEffect) {
    await applyFolderFromMetadataValue(contractId, value);
  }

  return data as MetadataValue;
}
