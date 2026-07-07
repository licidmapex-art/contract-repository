import type { PDFDocumentProxy } from "pdfjs-dist";

export interface PdfTextMatch {
  page: number;
  globalIndex: number;
}

export interface TextHighlightRange {
  start: number;
  end: number;
  isActive: boolean;
}

function joinPdfTextItems(
  items: Awaited<ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["getTextContent"]>>["items"]
): string {
  return items
    .map((item) => ("str" in item ? item.str : "").trim())
    .filter(Boolean)
    .join(" ");
}

export async function searchPdfDocument(
  pdf: PDFDocumentProxy,
  query: string
): Promise<PdfTextMatch[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const matches: PdfTextMatch[] = [];
  let globalIndex = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = joinPdfTextItems(content.items);
    const lower = text.toLowerCase();

    let start = 0;
    while (start < lower.length) {
      const found = lower.indexOf(normalizedQuery, start);
      if (found === -1) break;
      matches.push({ page: pageNumber, globalIndex });
      globalIndex++;
      start = found + normalizedQuery.length;
    }
  }

  return matches;
}

export function buildHighlightSegments(
  text: string,
  ranges: { start: number; end: number; isActive: boolean }[]
): { start: number; end: number; isActive: boolean }[] {
  return ranges
    .filter((range) => range.end > 0 && range.start < text.length)
    .map((range) => ({
      start: Math.max(0, range.start),
      end: Math.min(text.length, range.end),
      isActive: range.isActive,
    }))
    .sort((a, b) => a.start - b.start);
}

function clearSearchOverlays(root: ParentNode) {
  root.querySelectorAll(".pdf-search-overlay-layer").forEach((el) => el.remove());
}

function getOffsetWithinPage(
  element: HTMLElement,
  page: HTMLElement
): { left: number; top: number; width: number; height: number } {
  const elementRect = element.getBoundingClientRect();
  const pageRect = page.getBoundingClientRect();

  return {
    left: elementRect.left - pageRect.left,
    top: elementRect.top - pageRect.top,
    width: elementRect.width,
    height: elementRect.height,
  };
}

function createOverlay(
  page: HTMLElement,
  span: HTMLElement,
  localStart: number,
  localEnd: number,
  isActive: boolean
): HTMLElement | null {
  const text = span.textContent ?? "";
  if (!text.length || localEnd <= localStart) return null;

  const bounds = getOffsetWithinPage(span, page);
  const startFrac = localStart / text.length;
  const endFrac = localEnd / text.length;

  const overlay = document.createElement("div");
  overlay.className = isActive
    ? "pdf-search-overlay pdf-search-overlay--active"
    : "pdf-search-overlay";
  overlay.style.left = `${bounds.left + bounds.width * startFrac}px`;
  overlay.style.top = `${bounds.top}px`;
  overlay.style.width = `${Math.max(bounds.width * (endFrac - startFrac), 2)}px`;
  overlay.style.height = `${bounds.height}px`;

  return overlay;
}

export function highlightTextLayer(
  root: ParentNode,
  query: string,
  options: {
    activeGlobalMatchIndex: number;
    globalIndicesOnPage: number[];
    scrollToActive: boolean;
  }
): { totalOnPage: number; hasTextLayer: boolean; scrolledActive: boolean } {
  clearSearchOverlays(root);

  const pageEl = root.querySelector(".react-pdf__Page") as HTMLElement | null;
  const layer = root.querySelector(".react-pdf__Page__textContent");
  if (!pageEl || !layer) return { totalOnPage: 0, hasTextLayer: false, scrolledActive: false };

  const spans = [...layer.querySelectorAll("span")] as HTMLElement[];
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return { totalOnPage: 0, hasTextLayer: spans.length > 0, scrolledActive: false };

  const overlayLayer = document.createElement("div");
  overlayLayer.className = "pdf-search-overlay-layer";
  pageEl.appendChild(overlayLayer);

  let fullText = "";
  const spanRanges: { el: HTMLElement; start: number; end: number }[] = [];

  for (const span of spans) {
    const start = fullText.length;
    const text = span.textContent ?? "";
    fullText += text;
    spanRanges.push({ el: span, start, end: fullText.length });
    fullText += " ";
  }

  const lower = fullText.toLowerCase();
  const matchRanges: TextHighlightRange[] = [];
  let searchFrom = 0;
  let localMatchIndex = 0;

  while (searchFrom < lower.length) {
    const found = lower.indexOf(normalizedQuery, searchFrom);
    if (found === -1) break;

    const globalIndex = options.globalIndicesOnPage[localMatchIndex];
    matchRanges.push({
      start: found,
      end: found + normalizedQuery.length,
      isActive:
        globalIndex !== undefined &&
        globalIndex === options.activeGlobalMatchIndex,
    });
    localMatchIndex++;
    searchFrom = found + normalizedQuery.length;
  }

  let activeOverlay: HTMLElement | null = null;

  for (const match of matchRanges) {
    for (const spanRange of spanRanges) {
      if (match.end <= spanRange.start || match.start >= spanRange.end) continue;

      const localSegments = buildHighlightSegments(
        spanRange.el.textContent ?? "",
        [
          {
            start: match.start - spanRange.start,
            end: match.end - spanRange.start,
            isActive: match.isActive,
          },
        ]
      );

      for (const segment of localSegments) {
        const overlay = createOverlay(
          pageEl,
          spanRange.el,
          segment.start,
          segment.end,
          segment.isActive
        );
        if (!overlay) continue;
        overlayLayer.appendChild(overlay);
        if (segment.isActive) activeOverlay = overlay;
      }
    }
  }

  if (options.scrollToActive && activeOverlay) {
    activeOverlay.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  return {
    totalOnPage: matchRanges.length,
    hasTextLayer: spans.length > 0,
    scrolledActive: Boolean(options.scrollToActive && activeOverlay),
  };
}
