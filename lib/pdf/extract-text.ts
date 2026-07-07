import { needsOcr, ocrPdfWithGemini } from "@/lib/pdf/ocr";

export interface PdfTextExtractionResult {
  text: string;
  source: "native" | "ocr";
  numPages: number;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await extractPdfTextDetailed(buffer);
  return result.text;
}

export async function extractPdfTextDetailed(
  buffer: Buffer
): Promise<PdfTextExtractionResult> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  const native = data.text?.trim() ?? "";
  const numPages = data.numpages ?? 1;

  const ocrEnabled = process.env.PDF_OCR !== "false";
  if (!ocrEnabled || !needsOcr(native, numPages)) {
    return { text: native, source: "native", numPages };
  }

  console.info(
    `PDF has little embedded text (${native.length} chars, ${numPages} page(s)); running OCR`
  );

  try {
    const ocrText = await ocrPdfWithGemini(buffer);
    if (ocrText.trim()) {
      return { text: ocrText.trim(), source: "ocr", numPages };
    }
  } catch (error) {
    console.error("OCR failed, falling back to embedded text:", error);
  }

  return { text: native, source: "native", numPages };
}
