import { createAdminClient } from "@/lib/supabase/admin";

function hasValue(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && value.trim() !== "";
}

export async function buildNamingMetadata(
  contractId: string,
  overrides?: Record<string, string | null>
): Promise<Record<string, string | null>> {
  const supabase = createAdminClient();

  const [
    { data: values },
    { data: fieldDefs },
    { data: contract },
  ] = await Promise.all([
    supabase
      .from("metadata_values")
      .select("value, field_id")
      .eq("contract_id", contractId),
    supabase.from("metadata_fields").select("id, key"),
    supabase
      .from("contracts")
      .select(
        "legal_entity:legal_entities!legal_entity_id(name), counterparty:counterparties!counterparty_id(name)"
      )
      .eq("id", contractId)
      .single(),
  ]);

  const fieldKeyById = new Map(
    (fieldDefs ?? []).map((field) => [field.id, field.key])
  );

  const metadata: Record<string, string | null> = {};

  for (const row of values ?? []) {
    const key = fieldKeyById.get(row.field_id);
    if (key) metadata[key] = row.value;
  }

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (hasValue(value)) metadata[key] = value.trim();
    }
  }

  const legalEntity = (
    contract as { legal_entity?: { name: string } | null } | null
  )?.legal_entity?.name;
  const counterparty = (
    contract as { counterparty?: { name: string } | null } | null
  )?.counterparty?.name;

  if (legalEntity) metadata.legal_entity = legalEntity;
  if (counterparty) metadata.counterparty = counterparty;

  return metadata;
}
