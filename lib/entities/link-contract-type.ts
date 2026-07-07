import { createAdminClient } from "@/lib/supabase/admin";
import { resolveContractTypeId } from "@/lib/entities/contract-type";

export async function linkContractType(
  contractId: string,
  extracted: { key: string; value: string | null }[]
): Promise<void> {
  const supabase = createAdminClient();
  const { data: contractTypes } = await supabase
    .from("contract_types")
    .select("id, name")
    .order("name");

  const contractTypeId = resolveContractTypeId(
    extracted,
    contractTypes ?? []
  );

  await supabase
    .from("contracts")
    .update({ contract_type_id: contractTypeId })
    .eq("id", contractId);
}

export async function syncContractTypeMetadata(
  contractId: string,
  contractTypeId: string | null
): Promise<void> {
  const supabase = createAdminClient();

  const { data: field } = await supabase
    .from("metadata_fields")
    .select("id")
    .eq("key", "contract_type")
    .single();

  if (!field) return;

  if (!contractTypeId) {
    await supabase
      .from("metadata_values")
      .update({
        value: null,
        confirmed: false,
        updated_at: new Date().toISOString(),
      })
      .eq("contract_id", contractId)
      .eq("field_id", field.id);
    return;
  }

  const { data: contractType } = await supabase
    .from("contract_types")
    .select("name")
    .eq("id", contractTypeId)
    .single();

  if (!contractType) return;

  await supabase.from("metadata_values").upsert(
    {
      contract_id: contractId,
      field_id: field.id,
      value: contractType.name,
      confidence: 1,
      confirmed: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "contract_id,field_id" }
  );
}
