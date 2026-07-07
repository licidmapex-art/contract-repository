"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Folder,
  FolderInput,
  FolderOpen,
  GripVertical,
  Home,
  Inbox,
  Plus,
  Trash2,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ContractWithDetails } from "@/lib/types";
import {
  buildMoveTargetOptions,
  FolderPath,
  FolderRecord,
  folderPathLabel,
  getFolderLevel,
  reorderSiblingIds,
  UNASSIGNED_FOLDER_ID,
} from "@/lib/folders/navigation";
import { cn } from "@/lib/utils";

export function FolderBrowser({
  contracts,
  path,
  onPathChange,
  onFoldersUpdated,
}: {
  contracts: ContractWithDetails[];
  path: FolderPath;
  onPathChange: (path: FolderPath) => void;
  onFoldersUpdated?: () => void;
}) {
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);
  const [moveParentId, setMoveParentId] = useState<string>("");
  const [moveError, setMoveError] = useState<string | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const loadFolders = useCallback(() => {
    fetch("/api/folders")
      .then((r) => r.json())
      .then((data) => setFolders(data.folders ?? []))
      .catch(() => setFolders([]));
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    const validPath = path.filter(
      (segment) =>
        segment.kind === "unassigned" ||
        folders.some((folder) => folder.id === segment.id)
    );
    if (validPath.length !== path.length) {
      onPathChange(validPath);
    }
  }, [folders, path, onPathChange]);

  const level = useMemo(
    () => getFolderLevel(folders, contracts, path),
    [folders, contracts, path]
  );

  const canCreateFolder = !level.atLeaf;

  function navigateToDepth(depth: number) {
    onPathChange(path.slice(0, depth));
    setCreating(false);
    setCreateError(null);
    setMovingFolderId(null);
    setDeletingFolderId(null);
    setReorderMode(false);
    setDraggingFolderId(null);
    setReorderError(null);
  }

  function openFolder(chip: { id: string; isUnassigned?: boolean }) {
    if (chip.id === UNASSIGNED_FOLDER_ID) {
      onPathChange([...path, { kind: "unassigned" }]);
      setCreating(false);
      setCreateError(null);
      return;
    }

    const folder = folders.find((f) => f.id === chip.id);
    if (!folder) return;
    onPathChange([...path, { kind: "folder", id: folder.id, name: folder.name }]);
    setCreating(false);
    setCreateError(null);
    setMovingFolderId(null);
    setDeletingFolderId(null);
  }

  function startMove(folderId: string) {
    const folder = folders.find((f) => f.id === folderId);
    setMovingFolderId(folderId);
    setMoveParentId(folder?.parent_id ?? "");
    setMoveError(null);
    setDeletingFolderId(null);
    setCreating(false);
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setSaving(true);
    setCreateError(null);

    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newFolderName.trim(),
        parentId: level.parentFolderId,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setCreateError(data.error ?? "Failed to create folder");
      return;
    }

    setNewFolderName("");
    setCreating(false);
    loadFolders();
    onFoldersUpdated?.();
    onPathChange([
      ...path,
      { kind: "folder", id: data.folder.id, name: data.folder.name },
    ]);
  }

  async function handleMoveFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!movingFolderId) return;

    setSaving(true);
    setMoveError(null);

    const res = await fetch(`/api/folders/${movingFolderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentId: moveParentId === "" ? null : moveParentId,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setMoveError(data.error ?? "Failed to move folder");
      return;
    }

    setMovingFolderId(null);
    loadFolders();
    onFoldersUpdated?.();
  }

  async function handleDeleteFolder(folderId: string, folderName: string) {
    if (
      !window.confirm(
        `Delete "${folderName}" and all its subfolders? Contracts in those folders will become unassigned.`
      )
    ) {
      return;
    }

    setSaving(true);
    setDeletingFolderId(folderId);

    const res = await fetch(`/api/folders/${folderId}`, { method: "DELETE" });
    const data = await res.json();
    setSaving(false);
    setDeletingFolderId(null);

    if (!res.ok) {
      window.alert(data.error ?? "Failed to delete folder");
      return;
    }

    setMovingFolderId(null);
    loadFolders();
    onFoldersUpdated?.();
  }

  const siblingChips = useMemo(
    () => level.chips.filter((chip) => !chip.isUnassigned),
    [level.chips]
  );
  const siblingIds = useMemo(
    () => siblingChips.map((chip) => chip.id),
    [siblingChips]
  );

  async function persistFolderOrder(orderedIds: string[]) {
    setSaving(true);
    setReorderError(null);

    const res = await fetch("/api/folders/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentId: level.parentFolderId,
        orderedIds,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setReorderError(data.error ?? "Failed to reorder folders");
      return;
    }

    loadFolders();
    onFoldersUpdated?.();
  }

  function moveFolderInList(folderId: string, direction: -1 | 1) {
    const index = siblingIds.indexOf(folderId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= siblingIds.length) return;

    const next = [...siblingIds];
    [next[index], next[target]] = [next[target], next[index]];
    void persistFolderOrder(next);
  }

  function handleFolderDrop(targetId: string) {
    if (!draggingFolderId || draggingFolderId === targetId) {
      setDraggingFolderId(null);
      return;
    }

    const next = reorderSiblingIds(siblingIds, draggingFolderId, targetId);
    setDraggingFolderId(null);
    void persistFolderOrder(next);
  }

  const labels = folderPathLabel(path);
  const movingFolder = movingFolderId
    ? folders.find((f) => f.id === movingFolderId)
    : null;
  const moveTargets = movingFolderId
    ? buildMoveTargetOptions(movingFolderId, folders)
    : [];

  return (
    <Card className="flex w-56 shrink-0 flex-col overflow-hidden rounded-none border-y-0 border-l-0 bg-sidebar/50 md:w-64">
      <div className="border-b border-border px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Folders
        </p>
        <nav className="mt-2 flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => navigateToDepth(0)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
              path.length === 0
                ? "bg-primary/15 text-primary"
                : "text-muted hover:bg-accent hover:text-foreground"
            )}
            title="All folders"
          >
            <Home className="h-3 w-3" />
            All
          </button>
          {labels.map((label, index) => (
            <span key={`${label}-${index}`} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <button
                type="button"
                onClick={() => navigateToDepth(index + 1)}
                className={cn(
                  "max-w-[7rem] truncate rounded-md px-2 py-1 text-xs transition-colors",
                  index === path.length - 1
                    ? "bg-primary/15 text-primary"
                    : "text-muted hover:bg-accent hover:text-foreground"
                )}
                title={label}
              >
                {label}
              </button>
            </span>
          ))}
        </nav>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {level.atLeaf ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <FolderOpen className="h-8 w-8 text-primary/60" />
              <p className="text-xs font-medium text-foreground">
                {labels[labels.length - 1] ?? "Folder"}
              </p>
              <p className="text-lg font-bold text-primary">{level.contractCount}</p>
              <p className="text-[10px] text-muted">
                contract{level.contractCount === 1 ? "" : "s"}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  Subfolders
                  <span className="ml-1 text-muted-foreground">
                    ({level.contractCount})
                  </span>
                </p>
                {canCreateFolder && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setReorderMode((prev) => !prev);
                        setReorderError(null);
                        setMovingFolderId(null);
                        setCreating(false);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors",
                        reorderMode
                          ? "bg-primary/15 text-primary"
                          : "text-muted hover:bg-accent hover:text-foreground"
                      )}
                      title="Reorder folders"
                    >
                      <GripVertical className="h-3 w-3" />
                      Order
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreating((prev) => !prev);
                        setCreateError(null);
                        setMovingFolderId(null);
                        setReorderMode(false);
                      }}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"
                      title="New folder"
                    >
                      <Plus className="h-3 w-3" />
                      New
                    </button>
                  </div>
                )}
              </div>

              {reorderError && (
                <p className="mb-2 text-[10px] text-danger">{reorderError}</p>
              )}

              {reorderMode && siblingChips.length > 1 && (
                <p className="mb-2 text-[10px] text-muted">
                  Drag folders or use arrows to change order.
                </p>
              )}

              <AnimatePresence mode="popLayout">
                <div className="flex flex-col gap-1.5">
                  {siblingChips.map((chip, index) => (
                      <motion.div
                        key={chip.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03, duration: 0.2 }}
                        onDragOver={(e) => {
                          if (!reorderMode || !draggingFolderId) return;
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          if (!reorderMode) return;
                          e.preventDefault();
                          handleFolderDrop(chip.id);
                        }}
                        className={cn(
                          "group rounded-lg border border-border bg-card transition-all duration-200 hover:border-primary/30 hover:bg-primary/5",
                          chip.count === 0 && "border-dashed opacity-80",
                          movingFolderId === chip.id && "border-primary/40 ring-1 ring-primary/20",
                          draggingFolderId === chip.id && "opacity-50"
                        )}
                      >
                        <div className="flex items-center gap-1 px-2 py-2">
                          {reorderMode && (
                            <button
                              type="button"
                              draggable
                              onDragStart={() => setDraggingFolderId(chip.id)}
                              onDragEnd={() => setDraggingFolderId(null)}
                              className="cursor-grab rounded p-0.5 text-muted hover:bg-accent hover:text-foreground active:cursor-grabbing"
                              title="Drag to reorder"
                            >
                              <GripVertical className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => !reorderMode && openFolder(chip)}
                            disabled={reorderMode}
                            className={cn(
                              "flex min-w-0 flex-1 items-center gap-2 text-left",
                              reorderMode && "cursor-default"
                            )}
                          >
                            <Folder className="h-4 w-4 shrink-0 text-primary/70 group-hover:text-primary" />
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                              {chip.label}
                            </span>
                            <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-muted">
                              {chip.count}
                            </span>
                          </button>
                          {reorderMode ? (
                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                disabled={saving || index === 0}
                                onClick={() => moveFolderInList(chip.id, -1)}
                                className="rounded p-1 text-muted hover:bg-accent hover:text-foreground disabled:opacity-30"
                                title="Move up"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={saving || index === siblingChips.length - 1}
                                onClick={() => moveFolderInList(chip.id, 1)}
                                className="rounded p-1 text-muted hover:bg-accent hover:text-foreground disabled:opacity-30"
                                title="Move down"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => startMove(chip.id)}
                              className="rounded p-1 text-muted hover:bg-accent hover:text-foreground"
                              title="Move folder"
                            >
                              <FolderInput className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={saving && deletingFolderId === chip.id}
                              onClick={() => handleDeleteFolder(chip.id, chip.label)}
                              className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger"
                              title="Delete folder"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          )}
                        </div>
                      </motion.div>
                    ))}

                  {level.chips
                    .filter((chip) => chip.isUnassigned)
                    .map((chip) => (
                      <motion.button
                        key={chip.id}
                        type="button"
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => openFolder(chip)}
                        className="group flex w-full items-center gap-2 rounded-lg border border-dashed border-border bg-accent/30 px-2.5 py-2 text-left transition-all duration-200 hover:border-muted-foreground/30 hover:bg-accent/50"
                      >
                        <Inbox className="h-4 w-4 shrink-0 text-muted group-hover:text-foreground" />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground group-hover:text-foreground">
                          {chip.label}
                        </span>
                        <span className="shrink-0 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted">
                          {chip.count}
                        </span>
                      </motion.button>
                    ))}
                </div>
              </AnimatePresence>
            </>
          )}
        </div>

        {movingFolder && (
          <form
            onSubmit={handleMoveFolder}
            className="border-t border-border bg-card/50 px-3 py-3"
          >
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Move &ldquo;{movingFolder.name}&rdquo;
            </label>
            <select
              value={moveParentId}
              onChange={(e) => setMoveParentId(e.target.value)}
              className="mb-2 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
            >
              {moveTargets.map((target) => (
                <option
                  key={target.id ?? "root"}
                  value={target.id ?? ""}
                >
                  {target.label}
                </option>
              ))}
            </select>
            {moveError && (
              <p className="mb-2 text-[10px] text-danger">{moveError}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Moving..." : "Move"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMovingFolderId(null);
                  setMoveError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {canCreateFolder && creating && !movingFolder && (
          <form
            onSubmit={handleCreateFolder}
            className="border-t border-border bg-card/50 px-3 py-3"
          >
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              New folder
            </label>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. Natural gas"
              autoFocus
              className="mb-2 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {createError && (
              <p className="mb-2 text-[10px] text-danger">{createError}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving || !newFolderName.trim()}>
                {saving ? "Creating..." : "Create"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCreating(false);
                  setCreateError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
