import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export function isBenignPdfViewerError(message: string): boolean {
  return (
    message.includes("TextLayer task cancelled") ||
    message.includes("getRaw is not a function") ||
    message.includes("kidDict.getRaw is not a function") ||
    message.includes("parent.get is not a function")
  );
}

export function extractErrorMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  ) {
    return (value as { message: string }).message;
  }
  return "";
}
