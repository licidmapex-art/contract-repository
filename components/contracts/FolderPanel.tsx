"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ContractWithDetails } from "@/lib/types";
import { FolderRecord } from "@/lib/folders/navigation";
import { FOLDER_CONFIDENCE_THRESHOLD } from "@/lib/folders/match";
import { inputClass } from "@/lib/ui-classes";

function buildFolderOptions(folders: FolderRecord[]) {
  const byParent = new Map<string | null, FolderRecord[]>();
  for (const folder of folders) {
    const list = byParent.get(folder.parent_id) ?? [];
    list.push(folder);
    byParent.set(folder.parent_id, list);
  }

  const options: { id: string; label: string }[] = [];

  function walk(parentId: string | null, prefix: string) {
    const children = (byParent.get(parentId) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const child of children) {
      const label = prefix ? `${prefix} / ${child.name}` : child.name;
      options.push({ id: child.id, label });
      walk(child.id, label);
    }
  }

  walk(null, "");
  return options;
}

export function FolderPanel({
  contract,
  onUpdate,
  onConfirmExtracted,
}: {
  contract: ContractWithDetails;
  onUpdate: () => void;
  onConfirmExtracted?: (fieldId: string, value: string) => void;
}) {
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [addFolderId, setAddFolderId] = useState("");

  useEffect(() => {
    fetch("/api/folders")
      .then((r) => r.json())
      .then((data) => setFolders(data.folders ?? []));
  }, []);

  const folderOptions = useMemo(
    () => buildFolderOptions(folders),
    [folders]
  );

  const assignedIds = new Set(
    contract.folder_ids?.length
      ? contract.folder_ids
      : contract.folder_id
        ? [contract.folder_id]
        : []
  );

  const folderMeta = contract.metadata_values.find(
    (value) => value.metadata_fields?.key === "activity_folder"
  );

  async function addFolder(folderId: string) {
    setSaving(true);
    await fetch(`/api/contracts/${contract.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add_folder_id: folderId }),
    });
    setSaving(false);
    setAddFolderId("");
    onUpdate();
  }

  async function removeFolder(folderId: string) {
    setSaving(true);
    await fetch(`/api/contracts/${contract.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remove_folder_id: folderId }),
    });
    setSaving(false);
    onUpdate();
  }

  const needsReview =
    folderMeta &&
    !folderMeta.confirmed &&
    folderMeta.value &&
    (folderMeta.confidence ?? 0) < FOLDER_CONFIDENCE_THRESHOLD;

  const confidenceLabel =
    folderMeta?.confidence != null
      ? `${Math.round(folderMeta.confidence * 100)}%`
      : "—";

  const availableToAdd = folderOptions.filter((o) => !assignedIds.has(o.id));

  return (
    <Card>
      <CardContent>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Folder</h2>
          <Link
            href="/folders"
            className="text-xs text-primary hover:underline"
          >
            Manage folders
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {(contract.folder_paths ?? []).length ? (
            (contract.folder_paths ?? []).map((path, index) => {
              const folderId =
                contract.folders?.[index]?.id ??
                contract.folder_ids?.[index] ??
                null;
              return (
                <span
                  key={`${path}-${index}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-accent/40 px-2.5 py-1 text-xs text-foreground"
                >
                  {path}
                  {folderId && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => removeFolder(folderId)}
                      className="text-muted hover:text-danger disabled:opacity-50"
                      aria-label={`Remove ${path}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              );
            })
          ) : (
            <p className="text-xs text-muted">No folders assigned</p>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <select
            value={addFolderId}
            onChange={(e) => setAddFolderId(e.target.value)}
            disabled={saving || !availableToAdd.length}
            className={inputClass + " flex-1 text-sm disabled:opacity-50"}
          >
            <option value="">Add folder...</option>
            {availableToAdd.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!addFolderId || saving}
            onClick={() => addFolder(addFolderId)}
          >
            Add
          </Button>
        </div>

        {needsReview && folderMeta && (
          <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
            <p className="text-xs font-medium text-warning">
              AI suggestion ({confidenceLabel}) — needs review
            </p>
            <p className="mt-1 text-sm text-foreground">{folderMeta.value}</p>
            {onConfirmExtracted && (
              <Button
                size="sm"
                className="mt-2"
                onClick={() =>
                  onConfirmExtracted(folderMeta.field_id, folderMeta.value ?? "")
                }
              >
                Confirm folder
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
