import { generateGeminiMultimodal } from "@/lib/gemini/client";

const MIN_CHARS_PER_PAGE = 40;

export function needsOcr(text: string, numPages: number): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  const pages = Math.max(numPages, 1);
  return trimmed.length / pages < MIN_CHARS_PER_PAGE;
}

export async function ocrPdfWithGemini(buffer: Buffer): Promise<string> {
  const maxBytes = 15 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw new Error("PDF is too large for OCR (max 15 MB).");
  }

  const prompt = `Extract all readable text from this PDF exactly as it appears.
Preserve paragraph breaks and reading order across pages.
Include headers, footers, tables (as plain-text rows), and signature blocks.
Return only the extracted text with no commentary or markdown.`;

  const text = await generateGeminiMultimodal([
    {
      inlineData: {
        mimeType: "application/pdf",
        data: buffer.toString("base64"),
      },
    },
    { text: prompt },
  ]);

  return text.trim();
}
