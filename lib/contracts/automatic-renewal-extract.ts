import { ExtractedField } from "@/lib/gemini/extract";
import {
  AUTOMATIC_RENEWAL_FIELD_KEY,
  parseAutomaticRenewal,
  serializeAutomaticRenewal,
} from "@/lib/contracts/automatic-renewal";

export function normalizeAutomaticRenewalExtraction(
  extracted: ExtractedField[]
): ExtractedField[] {
  return extracted.map((item) => {
    if (item.key !== AUTOMATIC_RENEWAL_FIELD_KEY) return item;

    if (item.value == null || !String(item.value).trim()) {
      return { ...item, value: null };
    }

    const parsed = parseAutomaticRenewal(String(item.value));
    return {
      ...item,
      value: serializeAutomaticRenewal(parsed),
    };
  });
}
