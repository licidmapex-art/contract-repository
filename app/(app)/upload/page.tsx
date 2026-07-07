"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload as UploadIcon } from "lucide-react";
import { DOCUMENT_ROLES, DocumentRole } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { inputClass, labelClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface ContractOption {
  id: string;
  title: string | null;
}

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileList | null>(null);
  const [role, setRole] = useState<DocumentRole>("original");
  const [contractId, setContractId] = useState("");
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((data) => {
        setContracts(
          (data.contracts ?? []).map((c: ContractOption) => ({
            id: c.id,
            title: c.title,
          }))
        );
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!files?.length) return;

    setLoading(true);
    setStatus("Uploading...");

    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));
    formData.append("role", role);
    if (contractId) formData.append("contract_id", contractId);

    const res = await fetch("/api/contracts/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      setStatus(`Error: ${data.error}`);
      setLoading(false);
      return;
    }

    setStatus("Uploaded! Extraction running in background...");
    setTimeout(() => {
      router.push(`/contracts/${data.contract_id}`);
    }, 1500);
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all duration-200",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                setFiles(e.dataTransfer.files);
              }}
            >
              <UploadIcon className="mb-2 h-8 w-8 text-muted" />
              <p className="mb-2 text-sm text-muted">
                Drag & drop PDF files here
              </p>
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={(e) => setFiles(e.target.files)}
                className="text-sm text-muted"
              />
              {files && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {files.length} file(s) selected
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>Document role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as DocumentRole)}
                className={inputClass}
              >
                {DOCUMENT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Link to existing contract (optional)
              </label>
              <select
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
                className={inputClass}
              >
                <option value="">Create new contract</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title ?? "Untitled"}
                  </option>
                ))}
              </select>
            </div>

            {status && <p className="text-sm text-muted">{status}</p>}

            <Button
              type="submit"
              disabled={loading || !files?.length}
              className="w-full"
            >
              {loading ? "Uploading..." : "Upload & extract"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
