import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePartiesFromExtraction } from "@/lib/entities/match";

export async function linkContractParties(
  contractId: string,
  extracted: { key: string; value: string | null }[]
): Promise<void> {
  const supabase = createAdminClient();

  const [{ data: legalEntities }, { data: counterparties }] = await Promise.all([
    supabase.from("legal_entities").select("id, name").order("name"),
    supabase.from("counterparties").select("id, name").order("name"),
  ]);

  const legalEntityValue =
    extracted.find((e) => e.key === "legal_entity")?.value ?? null;
  const counterpartyValue =
    extracted.find((e) => e.key === "counterparty")?.value ?? null;

  const resolved = resolvePartiesFromExtraction(
    legalEntityValue,
    counterpartyValue,
    legalEntities ?? [],
    counterparties ?? []
  );

  let counterpartyId = resolved.counterparty?.id ?? null;

  if (!counterpartyId && resolved.counterpartyName?.trim()) {
    const { data: created } = await supabase
      .from("counterparties")
      .upsert({ name: resolved.counterpartyName.trim() }, { onConflict: "name" })
      .select("id")
      .single();

    counterpartyId = created?.id ?? null;
  }

  await supabase
    .from("contracts")
    .update({
      legal_entity_id: resolved.legalEntity?.id ?? null,
      counterparty_id: counterpartyId,
    })
    .eq("id", contractId);
}
