"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  extractErrorMessage,
  isBenignPdfViewerError,
} from "@/lib/pdf/pdfjs-worker";
import "@/lib/pdf/pdfjs-worker";
import {
  highlightTextLayer,
  searchPdfDocument,
} from "@/lib/pdf/search-document";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { inputClass } from "@/lib/ui-classes";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

type PdfFile = { data: Uint8Array };

export function PdfViewer({
  documentId,
  initialSearch = "",
  initialPage = 1,
  searchTrigger = 0,
}: {
  documentId: string;
  initialSearch?: string;
  initialPage?: number;
  searchTrigger?: number;
}) {
  const [pdfFile, setPdfFile] = useState<PdfFile | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [matchPages, setMatchPages] = useState<number[]>([]);
  const [matchIndex, setMatchIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [hasTextLayer, setHasTextLayer] = useState(true);
  const [textLayerReady, setTextLayerReady] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const viewerRef = useRef<HTMLDivElement>(null);
  const lastScrolledMatchIndex = useRef(-1);
  const [pageWidth, setPageWidth] = useState<number | null>(null);

  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      const message = args.map(extractErrorMessage).join(" ");
      if (isBenignPdfViewerError(message)) {
        return;
      }

      originalConsoleError(...args);
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  const handleTextLayerError = useCallback((err: Error) => {
    const message = err?.message ?? "";
    const name = (err as { name?: string } | null)?.name ?? "";
    const isAbort =
      name === "AbortException" || message.includes("TextLayer task cancelled");

    if (isAbort) {
      // Harmless during rapid page/search updates; avoid noisy console warnings.
      return;
    }

    console.error("Text layer render error:", err);
  }, []);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;

    const updateWidth = () => {
      setPageWidth(el.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);

    return () => observer.disconnect();
  }, [pdfFile]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setPdfFile(null);
    setPdfDoc(null);
    setPage(1);
    setNumPages(0);
    setSearch("");
    setMatchPages([]);
    setMatchIndex(-1);
    lastScrolledMatchIndex.current = -1;

    fetch(`/api/documents/${documentId}/file`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed to load PDF (${res.status})`);
        }
        const blob = await res.blob();
        const header = await blob.slice(0, 5).text();
        if (!header.startsWith("%PDF")) {
          throw new Error("File is not a valid PDF (corrupt or wrong format)");
        }
        return blob;
      })
      .then(async (blob) => {
        if (cancelled) return;
        const buffer = await blob.arrayBuffer();
        setPdfFile({ data: new Uint8Array(buffer) });
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    setSearch(initialSearch);
    setPage(Math.max(1, initialPage));
  }, [initialSearch, initialPage, searchTrigger, documentId]);

  useEffect(() => {
    if (!pdfDoc || !search.trim()) {
      setMatchPages([]);
      setMatchIndex(-1);
      lastScrolledMatchIndex.current = -1;
      return;
    }

    let cancelled = false;
    setSearching(true);

    const timer = window.setTimeout(() => {
      searchPdfDocument(pdfDoc, search)
        .then((matches) => {
          if (cancelled) return;
          setMatchPages(matches.map((match) => match.page));
          if (matches.length > 0) {
            setMatchIndex(0);
            lastScrolledMatchIndex.current = -1;
            setPage(matches[0].page);
          } else {
            setMatchIndex(-1);
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pdfDoc, search]);

  useEffect(() => {
    if (!viewerRef.current || !search.trim() || matchIndex < 0) return;

    const globalIndicesOnPage = matchPages
      .map((matchPage, globalIndex) => ({ matchPage, globalIndex }))
      .filter((entry) => entry.matchPage === page)
      .map((entry) => entry.globalIndex);

    const shouldScroll = lastScrolledMatchIndex.current !== matchIndex;

    const timer = window.setTimeout(() => {
      const result = highlightTextLayer(viewerRef.current!, search, {
        activeGlobalMatchIndex: matchIndex,
        globalIndicesOnPage,
        scrollToActive: shouldScroll,
      });
      if (shouldScroll && result.scrolledActive) {
        lastScrolledMatchIndex.current = matchIndex;
      }
      setHasTextLayer(result.hasTextLayer);
    }, 50);

    return () => window.clearTimeout(timer);
  }, [search, page, matchIndex, matchPages, pdfFile, pageWidth, textLayerReady]);

  const goToMatch = useCallback(
    (direction: 1 | -1) => {
      if (!matchPages.length) return;
      const nextIndex =
        (matchIndex + direction + matchPages.length) % matchPages.length;
      setMatchIndex(nextIndex);
      setPage(matchPages[nextIndex]);
    },
    [matchIndex, matchPages]
  );

  const handleStructTreeError = useCallback((err: Error) => {
    const message = err?.message ?? "";
    if (isBenignPdfViewerError(message)) return;
    console.warn("PDF structure tree error:", err);
  }, []);

  if (loading) {
    return (
      <Card className="flex h-96 items-center justify-center">
        <p className="text-sm text-muted">Loading PDF...</p>
      </Card>
    );
  }

  if (error || !pdfFile) {
    return (
      <Card className="flex h-96 flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-sm font-medium text-danger">Could not display PDF</p>
        <p className="text-sm text-muted">{error ?? "Unknown error"}</p>
        <a
          href={`/api/documents/${documentId}/file`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          Try opening in a new tab
        </a>
      </Card>
    );
  }

  const matchLabel =
    matchPages.length > 0
      ? `${matchIndex + 1} / ${matchPages.length}`
      : search.trim()
        ? "0 / 0"
        : "";

  return (
    <Card>
      <CardContent>
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search in document..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") goToMatch(e.shiftKey ? -1 : 1);
              }}
              className={inputClass + " min-w-[180px] flex-1"}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goToMatch(-1)}
              disabled={!matchPages.length}
            >
              Prev match
            </Button>
            <span className="min-w-[3rem] text-center text-sm text-muted">
              {searching ? "..." : matchLabel}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goToMatch(1)}
              disabled={!matchPages.length}
            >
              Next match
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Prev page
            </Button>
            <span className="text-sm text-muted">
              Page {page} / {numPages || "?"}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(numPages, p + 1))}
              disabled={page >= numPages}
            >
              Next page
            </Button>
          </div>

          {!hasTextLayer && (
            <p className="text-xs text-warning">
              This PDF has little or no embedded text layer. Scanned documents are
              OCR&apos;d on upload for metadata extraction, but in-document search
              still relies on the PDF text layer.
            </p>
          )}
          {search.trim() && !searching && matchPages.length === 0 && hasTextLayer && (
            <p className="text-xs text-muted">No matches found.</p>
          )}
        </div>

        <div ref={viewerRef} className="w-full max-h-[70vh] overflow-auto">
          <Document
            file={pdfFile}
            onLoadSuccess={(pdf) => {
              setNumPages(pdf.numPages);
              setPdfDoc(pdf);
            }}
            onLoadError={(err) => setError(err.message)}
            loading={<p className="p-4 text-sm text-muted">Rendering...</p>}
            className="flex w-full justify-center"
          >
            {pageWidth ? (
              <Page
                pageNumber={page}
                width={pageWidth}
                renderTextLayer
                className="!max-w-full"
                onGetStructTreeError={handleStructTreeError}
                onRenderTextLayerSuccess={() =>
                  setTextLayerReady((version) => version + 1)
                }
                onRenderTextLayerError={handleTextLayerError}
              />
            ) : (
              <p className="p-4 text-sm text-muted">Preparing viewer...</p>
            )}
          </Document>
        </div>
      </CardContent>
    </Card>
  );
}
