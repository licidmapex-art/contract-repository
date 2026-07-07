import { findBestEntityMatch } from "@/lib/entities/match";
import { ExtractedField } from "@/lib/gemini/extract";

export function normalizeContractTypeExtraction(
  extracted: ExtractedField[],
  contractTypes: { id: string; name: string }[]
): ExtractedField[] {
  if (!contractTypes.length) return extracted;

  return extracted.map((item) => {
    if (item.key !== "contract_type" || !item.value?.trim()) return item;

    const match = findBestEntityMatch(item.value, contractTypes);
    if (!match) {
      return { ...item, value: null, confidence: 0 };
    }

    return { ...item, value: match.name };
  });
}

export function resolveContractTypeId(
  extracted: { key: string; value: string | null }[],
  contractTypes: { id: string; name: string }[]
): string | null {
  const raw = extracted.find((e) => e.key === "contract_type")?.value;
  if (!raw?.trim() || !contractTypes.length) return null;
  return findBestEntityMatch(raw, contractTypes)?.id ?? null;
}
