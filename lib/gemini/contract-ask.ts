import { generateGeminiText } from "@/lib/gemini/client";

function truncateText(text: string, maxChars = 35000): string {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, 30000);
  const tail = text.slice(-5000);
  return `${head}\n\n[... truncated ...]\n\n${tail}`;
}

export async function askSingleContract(
  question: string,
  payload: {
    metadata: Record<string, string | null>;
    extractedText: string;
  }
): Promise<string> {
  const metadataSummary = Object.entries(payload.metadata)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

  const prompt = `Answer the question using ONLY this contract.
Do NOT mention the contract name/title or id.
Give a direct answer first. Then one short quote from the contract text as evidence.
If the answer is not present, say "Not found in this contract."

Metadata:
${metadataSummary || "None"}

Contract text:
"""${truncateText(payload.extractedText)}"""

Question:
${question}`;

  const answer = await generateGeminiText(prompt);
  return answer.trim();
}
