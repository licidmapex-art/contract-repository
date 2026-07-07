"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FolderRecord } from "@/lib/folders/navigation";
import { BulkMetadataMode, MetadataField } from "@/lib/types";
import { inputClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

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

export function BulkEditBar({
  selectedIds,
  onClearSelection,
  onComplete,
}: {
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onComplete: () => void;
}) {
  const [fields, setFields] = useState<MetadataField[]>([]);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [editKind, setEditKind] = useState<"metadata" | "folder">("metadata");
  const [fieldId, setFieldId] = useState("");
  const [value, setValue] = useState("");
  const [metadataMode, setMetadataMode] = useState<BulkMetadataMode>("set");
  const [folderId, setFolderId] = useState("");
  const [folderMode, setFolderMode] = useState<"add" | "remove" | "set">("add");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/metadata-fields")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.fields ?? []) as MetadataField[];
        setFields(list);
        if (list.length && !fieldId) setFieldId(list[0].id);
      });
    fetch("/api/folders")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.folders ?? []) as FolderRecord[];
        setFolders(list);
        if (list.length && !folderId) setFolderId(list[0].id);
      });
  }, [fieldId, folderId]);

  const folderOptions = useMemo(() => buildFolderOptions(folders), [folders]);
  const selectedField = fields.find((f) => f.id === fieldId);

  async function applyBulkEdit() {
    setSaving(true);
    setMessage(null);

    const body: Record<string, unknown> = {
      contractIds: [...selectedIds],
    };

    if (editKind === "metadata") {
      if (!fieldId) {
        setMessage("Select a metadata field");
        setSaving(false);
        return;
      }
      body.metadataUpdates = [
        {
          fieldId,
          value: value.trim() || null,
          mode: metadataMode,
        },
      ];
    } else {
      if (!folderId) {
        setMessage("Select a folder");
        setSaving(false);
        return;
      }
      body.folderUpdates = [{ folderId, mode: folderMode }];
    }

    const res = await fetch("/api/contracts/bulk-metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setMessage(data.error ?? "Bulk update failed");
      return;
    }

    const failed = data.failed ?? 0;
    setMessage(
      failed
        ? `Updated ${data.updated} contract(s); ${failed} failed`
        : `Updated ${data.updated} contract(s)`
    );
    onComplete();
  }

  if (!selectedIds.size) return null;

  return (
    <div className="sticky top-0 z-10 rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-foreground">
          {selectedIds.size} selected
        </span>

        <select
          value={editKind}
          onChange={(e) => setEditKind(e.target.value as "metadata" | "folder")}
          className={cn(inputClass, "w-auto text-sm")}
        >
          <option value="metadata">Metadata</option>
          <option value="folder">Folder</option>
        </select>

        {editKind === "metadata" ? (
          <>
            <select
              value={fieldId}
              onChange={(e) => setFieldId(e.target.value)}
              className={cn(inputClass, "max-w-[12rem] text-sm")}
            >
              {fields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
            </select>

            <select
              value={metadataMode}
              onChange={(e) =>
                setMetadataMode(e.target.value as BulkMetadataMode)
              }
              className={cn(inputClass, "w-auto text-sm")}
            >
              <option value="set">Set value</option>
              <option value="add">Add to value</option>
            </select>

            {selectedField?.field_type === "boolean" ? (
              <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={cn(inputClass, "w-auto text-sm")}
              >
                <option value="">— Clear —</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : selectedField?.field_type === "enum" &&
              selectedField.enum_options?.length ? (
              <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={cn(inputClass, "max-w-[12rem] text-sm")}
              >
                <option value="">— Clear —</option>
                {selectedField.enum_options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={selectedField?.field_type === "date" ? "date" : "text"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Value"
                className={cn(inputClass, "min-w-[10rem] text-sm")}
              />
            )}
          </>
        ) : (
          <>
            <select
              value={folderMode}
              onChange={(e) =>
                setFolderMode(e.target.value as "add" | "remove" | "set")
              }
              className={cn(inputClass, "w-auto text-sm")}
            >
              <option value="add">Add folder</option>
              <option value="remove">Remove folder</option>
              <option value="set">Replace all folders</option>
            </select>

            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className={cn(inputClass, "max-w-[16rem] text-sm")}
            >
              {folderOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </>
        )}

        <Button size="sm" onClick={applyBulkEdit} disabled={saving}>
          {saving ? "Applying..." : "Apply"}
        </Button>

        <button
          type="button"
          onClick={onClearSelection}
          className="ml-auto flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
          Clear
        </button>
      </div>

      {message && (
        <p className="mt-2 text-xs text-muted">{message}</p>
      )}
    </div>
  );
}
