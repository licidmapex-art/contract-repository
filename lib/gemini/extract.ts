import { MetadataField } from "@/lib/types";
import { generateGeminiText } from "@/lib/gemini/client";

export interface ExtractedField {
  key: string;
  value: string | null;
  confidence: number;
  evidence_page: number | null;
  evidence_text: string | null;
}

function truncateText(text: string, maxChars = 35000): string {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, 30000);
  const tail = text.slice(-5000);
  return `${head}\n\n[... truncated ...]\n\n${tail}`;
}

export async function extractMetadataFields(
  fields: MetadataField[],
  documentText: string,
  options?: {
    legalEntityNames?: string[];
    contractTypeNames?: string[];
    folderPaths?: string[];
  }
): Promise<ExtractedField[]> {

  const fieldDescriptions = fields
    .map(
      (f) =>
        `- key: "${f.key}", label: "${f.label}", type: ${f.field_type}, instructions: ${f.playbook_prompt}`
    )
    .join("\n");

  const legalEntities = options?.legalEntityNames?.filter(Boolean) ?? [];
  const legalEntityContext =
    legalEntities.length > 0
      ? `
Known legal entities (OUR companies — these are NOT counterparties):
${legalEntities.map((name) => `- ${name}`).join("\n")}

Party extraction rules:
- For "legal_entity": return the name from the known legal entities list that appears in this contract.
- For "counterparty": return only the EXTERNAL party. Never return any name from the known legal entities list.
- If both parties appear in the document, assign each to the correct field.
`
      : "";

  const contractTypes = options?.contractTypeNames?.filter(Boolean) ?? [];
  const contractTypeContext =
    contractTypes.length > 0
      ? `
Known contract types (return ONLY an exact name from this list for "contract_type", or null):
${contractTypes.map((name) => `- ${name}`).join("\n")}
`
      : "";

  const folderPaths = options?.folderPaths?.filter(Boolean) ?? [];
  const folderContext =
    folderPaths.length > 0
      ? `
Known folders (return ONLY the best matching full path from this list for "activity_folder", or null if none fit):
Use the full path including parent folders when applicable (e.g. "Natural gas / EU").
A contract may belong to multiple folders over time; pick the single best match for this document.
${folderPaths.map((path) => `- ${path}`).join("\n")}
`
      : "";

  const prompt = `You are extracting metadata fields from a contract document.
${legalEntityContext}${contractTypeContext}${folderContext}
For each field below, extract the value from the document text.
Return ONLY valid JSON with this exact shape:
{
  "fields": [
    {
      "key": "field_key",
      "value": "extracted value or null",
      "confidence": 0.0,
      "evidence_page": 1,
      "evidence_text": "short excerpt from the document proving this value"
    }
  ]
}

Rules:
- confidence is 0.0 to 1.0
- If a field cannot be determined, use null for value and 0 for confidence
- evidence_page is the 1-based page number where the evidence appears; use null if unknown
- evidence_text is a short quote (about 8-25 words) from the source text supporting the extraction; use null if unknown
- For date fields use ISO format YYYY-MM-DD
- For number fields return only the number as a string
- Include ALL fields listed below

Fields to extract:
${fieldDescriptions}

Document text:
"""${truncateText(documentText)}"""`;

  const text = await generateGeminiText(prompt);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Gemini returned non-JSON response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    fields: {
      key: string;
      value: string | null;
      confidence: number;
      evidence_page?: number | null;
      evidence_text?: string | null;
    }[];
  };

  const byKey = new Map(
    (parsed.fields ?? []).map((field) => [field.key, field])
  );

  return fields.map((field) => {
    const match = byKey.get(field.key);
    return {
      key: field.key,
      value: match?.value ?? null,
      confidence:
        typeof match?.confidence === "number" ? match.confidence : 0,
      evidence_page:
        typeof match?.evidence_page === "number" &&
        Number.isFinite(match.evidence_page)
          ? Math.max(1, Math.floor(match.evidence_page))
          : null,
      evidence_text: match?.evidence_text?.trim() || null,
    };
  });
}

export async function translateQuestionToFilters(
  question: string,
  fields: MetadataField[]
): Promise<{ filters: { field: string; op: string; value: string }[] }> {
  const fieldList = fields
    .map((f) => `- ${f.key} (${f.label}, type: ${f.field_type})`)
    .join("\n");

  const today = new Date().toISOString().slice(0, 10);

  const prompt = `Translate this natural language question about contracts into structured filters.

Today's date (ISO): ${today}
Use this when interpreting relative periods like "this quarter", "this month", or "next 60 days".
For date range questions, emit separate filters with >= and <= on the date field (e.g. expiry_date).
Date values must be ISO format YYYY-MM-DD.

Available fields:
${fieldList}

Also available: status (active, inactive, expiring, upcoming_renewal, expired)

Question: "${question}"

Return ONLY valid JSON:
{"filters": [{"field": "field_key", "op": "=" | "!=" | "<" | "<=" | ">" | ">=" | "contains", "value": "..."}]}

Use field keys exactly as listed. For status questions use field "status".`;

  const text = await generateGeminiText(prompt);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { filters: [] };
  return JSON.parse(jsonMatch[0]);
}

export async function generateAnswer(
  question: string,
  contracts: { title: string | null; id: string; metadata: Record<string, string | null> }[]
): Promise<string> {
  const contractSummary = contracts
    .map(
      (c) =>
        `- ${c.title ?? "Untitled"} (id: ${c.id}): ${Object.entries(c.metadata)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`
    )
    .join("\n");

  const prompt = `Answer this question about contracts based on the matching contracts below.
Cite contract titles in your answer. Be concise.

Question: ${question}

Matching contracts (${contracts.length}):
${contractSummary || "None found."}`;

  return generateGeminiText(prompt);
}

export async function generateContractAnswer(
  question: string,
  contract: {
    id: string;
    title: string | null;
    metadata: Record<string, string | null>;
    documentTexts: string[];
  }
): Promise<string> {
  const metadataSummary = Object.entries(contract.metadata)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

  const combinedText = truncateText(
    contract.documentTexts.filter(Boolean).join("\n\n---\n\n")
  );

  const prompt = `Answer the user's question using ONLY this single contract.
If the answer is not in this contract, say that clearly.
Be concise and quote short excerpts when possible.

Contract title: ${contract.title ?? "Untitled"}
Contract id: ${contract.id}

Metadata:
${metadataSummary || "None"}

Contract text:
"""${combinedText || "No extracted text available."}"""

Question:
${question}`;

  return generateGeminiText(prompt);
}