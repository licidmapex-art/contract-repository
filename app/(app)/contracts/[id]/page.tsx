"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { StatusChip } from "@/components/ui/StatusChip";
import { PdfViewer } from "@/components/pdf/PdfViewer";
import { RelationshipsPanel } from "@/components/contracts/RelationshipsPanel";
import { ContractPartiesPanel } from "@/components/contracts/ContractPartiesPanel";
import { ContractTypePanel } from "@/components/contracts/ContractTypePanel";
import { FolderPanel } from "@/components/contracts/FolderPanel";
import { NoticePeriodPanel } from "@/components/contracts/NoticePeriodPanel";
import { AutomaticRenewalPanel } from "@/components/contracts/AutomaticRenewalPanel";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ContractWithDetails } from "@/lib/types";
import { inputClass } from "@/lib/ui-classes";

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contract, setContract] = useState<ContractWithDetails | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [viewerSearch, setViewerSearch] = useState("");
  const [viewerPage, setViewerPage] = useState(1);
  const [viewerSearchTrigger, setViewerSearchTrigger] = useState(0);
  const [loading, setLoading] = useState(true);

  const [reExtracting, setReExtracting] = useState<string | null>(null);
  const [extractMessage, setExtractMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [contractQuestion, setContractQuestion] = useState("");
  const [contractAnswer, setContractAnswer] = useState<string | null>(null);
  const [askingContract, setAskingContract] = useState(false);

  const loadContract = useCallback(async () => {
    const res = await fetch(`/api/contracts/${id}`);
    const data = await res.json();
    setContract(data.contract);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadContract();
    const interval = setInterval(loadContract, 5000);
    return () => clearInterval(interval);
  }, [loadContract]);

  async function reExtractDocument(documentId: string) {
    setReExtracting(documentId);
    setExtractMessage(null);

    const res = await fetch(`/api/documents/${documentId}/re-extract`, {
      method: "POST",
    });
    const data = await res.json();

    setReExtracting(null);
    if (!res.ok) {
      setExtractMessage(data.error ?? "Extraction failed");
      return;
    }

    setExtractMessage("Extraction complete. Refreshing...");
    loadContract();
  }

  async function deleteContract() {
    const label = contract?.title ?? "this contract";
    if (
      !window.confirm(
        `Delete "${label}"? This removes all documents and metadata. This cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);
    const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
    setDeleting(false);

    if (!res.ok) {
      const data = await res.json();
      setExtractMessage(data.error ?? "Failed to delete contract");
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function confirmField(fieldId: string, value: string) {
    await fetch(`/api/contracts/${id}/metadata/${fieldId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    loadContract();
  }

  async function askAboutContract(e: React.FormEvent) {
    e.preventDefault();
    if (!contractQuestion.trim()) return;

    setAskingContract(true);
    setContractAnswer(null);

    const res = await fetch(`/api/contracts/${id}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: contractQuestion }),
    });
    const data = await res.json();
    setContractAnswer(data.answer ?? data.error ?? "No answer returned");
    setAskingContract(false);
  }

  function viewMetadataEvidence(
    sourceDocumentId: string | null,
    evidencePage: number | null,
    evidenceText: string | null
  ) {
    const query = evidenceText?.trim() ?? "";

    if (sourceDocumentId) {
      setSelectedDocId(sourceDocumentId);
    } else if (contract?.documents.length) {
      setSelectedDocId(contract.documents[0].id);
    }

    if (evidencePage && evidencePage > 0) {
      setViewerPage(evidencePage);
    } else {
      setViewerPage(1);
    }
    setViewerSearch(query);
    setViewerSearchTrigger((v) => v + 1);

    if (!query) {
      setExtractMessage(
        "No evidence snippet is stored for this field yet. Re-extract to generate anchored evidence."
      );
    } else {
      setExtractMessage(null);
    }
  }

  if (loading) return <p className="text-muted">Loading...</p>;
  if (!contract) return <p className="text-danger">Contract not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-foreground">
            {contract.display_name ?? contract.title ?? "Untitled contract"}
          </h1>
          <div className="mt-2">
            <StatusChip status={contract.effective_status} />
          </div>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={deleteContract}
          disabled={deleting}
        >
          {deleting ? "Deleting..." : "Delete contract"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="space-y-4">
          <Card>
            <CardContent>
              <h2 className="mb-3 font-semibold text-foreground">Documents</h2>
              <ul className="space-y-2">
                {contract.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-accent/30"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {doc.original_filename}
                      </p>
                      <p className="text-xs text-muted">
                        {doc.role} · {doc.processing_status}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedDocId(doc.id)}
                        className="text-sm text-primary hover:underline"
                      >
                        View
                      </button>
                      {(doc.processing_status === "failed" ||
                        doc.processing_status === "complete") && (
                        <button
                          onClick={() => reExtractDocument(doc.id)}
                          disabled={reExtracting === doc.id}
                          className="text-sm text-muted hover:underline disabled:opacity-50"
                        >
                          {reExtracting === doc.id ? "Extracting..." : "Re-extract"}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <ContractTypePanel contract={contract} onUpdate={loadContract} />

          <FolderPanel
            contract={contract}
            onUpdate={loadContract}
            onConfirmExtracted={(fieldId, value) => confirmField(fieldId, value)}
          />

          <NoticePeriodPanel
            contract={contract}
            onConfirmExtracted={(fieldId, value) => confirmField(fieldId, value)}
          />

          <AutomaticRenewalPanel
            contract={contract}
            onConfirmExtracted={(fieldId, value) => confirmField(fieldId, value)}
          />

          <ContractPartiesPanel contract={contract} onUpdate={loadContract} />

          <Card>
            <CardContent>
              <h2 className="mb-3 font-semibold text-foreground">Metadata</h2>
              <div className="space-y-3">
                {contract.metadata_values
                  .filter(
                    (mv) =>
                      !["activity_folder", "notice_period", "notice_period_days", "automatic_renewal"].includes(
                        mv.metadata_fields?.key ?? ""
                      )
                  )
                  .map((mv) => (
                  <MetadataRow
                    key={mv.id}
                    label={mv.metadata_fields?.label ?? "Unknown"}
                    value={mv.value ?? ""}
                    sourceDocumentId={mv.source_document_id}
                    evidencePage={mv.evidence_page}
                    evidenceText={mv.evidence_text}
                    confirmed={mv.confirmed}
                    confidence={mv.confidence}
                    onConfirm={(value) => confirmField(mv.field_id, value)}
                    onViewEvidence={(
                      sourceDocumentId,
                      evidencePage,
                      evidenceText
                    ) =>
                      viewMetadataEvidence(
                        sourceDocumentId,
                        evidencePage,
                        evidenceText
                      )
                    }
                  />
                ))}
                {!contract.metadata_values.length && (
                  <p className="text-sm text-muted">
                    No metadata yet. If status shows &quot;failed&quot;, click
                    Re-extract on the document. Scanned PDFs are OCR&apos;d
                    automatically on upload.
                  </p>
                )}
                {extractMessage && (
                  <p className="text-sm text-muted">{extractMessage}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <RelationshipsPanel
            contractId={contract.id}
            relationships={contract.relationships}
            onUpdate={loadContract}
          />

          <Card>
            <CardContent>
              <h2 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Ask AI about this contract
              </h2>
              <p className="mb-3 text-xs text-muted">
                AI answers using only this contract&apos;s metadata and extracted
                document text.
              </p>
              <form onSubmit={askAboutContract} className="flex gap-2">
                <input
                  type="text"
                  value={contractQuestion}
                  onChange={(e) => setContractQuestion(e.target.value)}
                  placeholder="What is the governing law in this contract?"
                  className={inputClass + " flex-1"}
                />
                <Button type="submit" disabled={askingContract}>
                  {askingContract ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                      Asking...
                    </>
                  ) : (
                    "Ask"
                  )}
                </Button>
              </form>
              {askingContract && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  AI is reading this contract...
                </div>
              )}
              {contractAnswer && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-muted">
                  {contractAnswer}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          {selectedDocId ? (
            <PdfViewer
              documentId={selectedDocId}
              initialSearch={viewerSearch}
              initialPage={viewerPage}
              searchTrigger={viewerSearchTrigger}
            />
          ) : (
            <Card className="flex h-96 items-center justify-center border-dashed">
              <p className="text-sm text-muted">Select a document to view</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function MetadataRow({
  label,
  value,
  sourceDocumentId,
  evidencePage,
  evidenceText,
  confirmed,
  confidence,
  onConfirm,
  onViewEvidence,
}: {
  label: string;
  value: string;
  sourceDocumentId: string | null;
  evidencePage: number | null;
  evidenceText: string | null;
  confirmed: boolean;
  confidence: number | null;
  onConfirm: (value: string) => void;
  onViewEvidence: (
    sourceDocumentId: string | null,
    evidencePage: number | null,
    evidenceText: string | null
  ) => void;
}) {
  const [editValue, setEditValue] = useState(value);
  const hasValue = value.trim().length > 0;
  const confidenceLabel =
    confidence !== null ? `${Math.round(confidence * 100)}%` : "—";

  useEffect(() => setEditValue(value), [value]);

  return (
    <div className="rounded-lg border border-border p-3 transition-colors hover:bg-accent/20">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {confirmed ? (
          <span className="text-xs text-success">Confirmed</span>
        ) : (
          <span className="text-xs text-warning">
            {hasValue
              ? `Review (${confidenceLabel})`
              : `No value proposed (${confidenceLabel})`}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className={inputClass + " flex-1"}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            onViewEvidence(sourceDocumentId, evidencePage, evidenceText)
          }
        >
          View in contract
        </Button>
        {!confirmed && (
          <Button size="sm" onClick={() => onConfirm(editValue)}>
            Confirm
          </Button>
        )}
      </div>
    </div>
  );
}
