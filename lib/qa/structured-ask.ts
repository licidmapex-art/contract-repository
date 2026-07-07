import {
  generateAnswer,
  translateQuestionToFilters,
} from "@/lib/gemini/extract";
import { applyStructuredFilters } from "@/lib/filters/build-query";
import { fetchAllContractsWithDetails } from "@/lib/contracts/fetch";
import { MetadataField } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AskResult {
  answer: string;
  filters: { field: string; op: string; value: string }[];
  contract_ids: string[];
  count: number;
}

export async function structuredAsk(question: string): Promise<AskResult> {
  const supabase = createAdminClient();
  const { data: fields } = await supabase.from("metadata_fields").select("*");

  const structured = await translateQuestionToFilters(
    question,
    (fields ?? []) as MetadataField[]
  );

  const allContracts = await fetchAllContractsWithDetails();
  const matching = applyStructuredFilters(
    allContracts.map((c) => ({
      id: c.id,
      status: c.status,
      metadata_values: c.metadata_values,
    })),
    structured.filters as Parameters<typeof applyStructuredFilters>[1]
  );

  const matchingIds = new Set(matching.map((c) => c.id));
  const matchedContracts = allContracts.filter((c) => matchingIds.has(c.id));

  const answer = await generateAnswer(
    question,
    matchedContracts.map((c) => ({
      id: c.id,
      title: c.display_name ?? c.title,
      metadata: Object.fromEntries(
        c.metadata_values.map((v) => [
          v.metadata_fields?.key ?? "unknown",
          v.value,
        ])
      ),
    }))
  );

  return {
    answer,
    filters: structured.filters,
    contract_ids: matchedContracts.map((c) => c.id),
    count: matchedContracts.length,
  };
}
