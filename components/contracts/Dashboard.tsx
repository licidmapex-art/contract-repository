"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Folder,
  GripVertical,
  Search,
  Sparkles,
  Timer,
  X,
} from "lucide-react";
import { StatusChip, statusChipStyles, statusDotStyles, statusLabels, STATUS_FILTER_OPTIONS } from "@/components/ui/StatusChip";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ContractWithDetails } from "@/lib/types";
import {
  formatNoticePeriod,
  isNoticePeriodFieldKey,
  parseNoticePeriod,
} from "@/lib/contracts/notice-period";
import {
  formatAutomaticRenewal,
  parseAutomaticRenewal,
} from "@/lib/contracts/automatic-renewal";
import { cn } from "@/lib/utils";

function FolderPathBreadcrumb({ path }: { path: string }) {
  const segments = path.split(" / ").filter(Boolean);
  if (!segments.length) return <span className="text-xs text-muted">—</span>;

  return (
    <span className="inline-flex flex-wrap items-center gap-0.5 text-xs text-foreground">
      {segments.map((segment, index) => (
        <span key={`${segment}-${index}`} className="inline-flex items-center gap-0.5">
          {index > 0 && (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          {index === 0 && (
            <Folder className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          <span>{segment}</span>
        </span>
      ))}
    </span>
  );
}

function ContractFolderPaths({ contract }: { contract: ContractWithDetails }) {
  const paths = contract.folder_paths ?? [];
  if (!paths.length) {
    return <span className="text-xs text-muted">Unassigned</span>;
  }

  return (
    <div className="flex max-w-md flex-col gap-1.5">
      {paths.map((path) => (
        <FolderPathBreadcrumb key={path} path={path} />
      ))}
    </div>
  );
}

export function ContractTable({
  contracts,
  loading,
  showFolderPaths = false,
  selectable = false,
  selectedIds,
  onSelectedIdsChange,
}: {
  contracts: ContractWithDetails[];
  loading?: boolean;
  showFolderPaths?: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectedIdsChange?: (ids: Set<string>) => void;
}) {
  type CoreColumnKey =
    | "contract_id"
    | "title"
    | "legal_entity"
    | "counterparty"
    | "status"
    | "review";
  type ColumnKey = CoreColumnKey | `meta:${string}`;

  const coreColumns: { key: CoreColumnKey; label: string }[] = [
    { key: "contract_id", label: "Contract ID" },
    { key: "title", label: "Title" },
    { key: "legal_entity", label: "Legal entity" },
    { key: "counterparty", label: "Counterparty" },
    { key: "status", label: "Status" },
    { key: "review", label: "Review" },
  ];

  const metadataFieldMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const contract of contracts) {
      for (const mv of contract.metadata_values) {
        const key = mv.metadata_fields?.key;
        if (!key || map.has(key)) continue;
        map.set(key, mv.metadata_fields?.label ?? key);
      }
    }
    return map;
  }, [contracts]);

  const [activeColumns, setActiveColumns] = useState<ColumnKey[]>([
    "contract_id",
    "title",
    "legal_entity",
    "counterparty",
    "status",
    "meta:expiry_date",
    "review",
  ]);
  const [draggingColumn, setDraggingColumn] = useState<ColumnKey | null>(null);
  const [rearrangeMode, setRearrangeMode] = useState(false);
  const [sortMode, setSortMode] = useState(false);
  const [sortColumn, setSortColumn] = useState<ColumnKey>("contract_id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const available = new Set<ColumnKey>([
      ...coreColumns.map((col) => col.key),
      ...[...metadataFieldMap.keys()].map((key) => `meta:${key}` as ColumnKey),
    ]);
    setActiveColumns((prev) => prev.filter((key) => available.has(key)));
  }, [metadataFieldMap]);

  const allColumns = useMemo(
    () => [
      ...coreColumns.map((col) => ({ key: col.key as ColumnKey, label: col.label })),
      ...[...metadataFieldMap.entries()].map(([key, label]) => ({
        key: `meta:${key}` as ColumnKey,
        label,
      })),
    ],
    [metadataFieldMap]
  );

  const availableColumns = allColumns
    .filter((col) => !activeColumns.includes(col.key))
    .sort((a, b) => a.label.localeCompare(b.label));

  function addColumn(key: string) {
    if (!key || activeColumns.includes(key as ColumnKey)) return;
    setActiveColumns((prev) => [...prev, key as ColumnKey]);
  }

  function removeColumn(key: ColumnKey) {
    setActiveColumns((prev) => prev.filter((k) => k !== key));
  }

  function moveColumn(key: ColumnKey, direction: -1 | 1) {
    setActiveColumns((prev) => {
      const index = prev.indexOf(key);
      if (index < 0) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function moveColumnToTarget(dragKey: ColumnKey, targetKey: ColumnKey) {
    if (dragKey === targetKey) return;
    setActiveColumns((prev) => {
      const from = prev.indexOf(dragKey);
      const to = prev.indexOf(targetKey);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, dragKey);
      return next;
    });
  }

  function metadataValue(contract: ContractWithDetails, key: string): string {
    if (key === "activity_folder") {
      const paths = contract.folder_paths ?? [];
      if (paths.length) return paths.join("; ");
    }

    if (isNoticePeriodFieldKey(key)) {
      const value =
        contract.metadata_values.find((v) =>
          isNoticePeriodFieldKey(v.metadata_fields?.key)
        )?.value ?? null;
      return formatNoticePeriod(parseNoticePeriod(value));
    }

    if (key === "automatic_renewal") {
      const value =
        contract.metadata_values.find(
          (v) => v.metadata_fields?.key === "automatic_renewal"
        )?.value ?? null;
      return formatAutomaticRenewal(parseAutomaticRenewal(value));
    }

    if (key === "counterparty") {
      return (
        contract.counterparty?.name ??
        contract.metadata_values.find((v) => v.metadata_fields?.key === "counterparty")
          ?.value ??
        "—"
      );
    }

    if (key === "legal_entity") {
      return (
        contract.legal_entity?.name ??
        contract.metadata_values.find((v) => v.metadata_fields?.key === "legal_entity")
          ?.value ??
        "—"
      );
    }

    return (
      contract.metadata_values.find((v) => v.metadata_fields?.key === key)?.value ??
      "—"
    );
  }

  function columnLabel(columnKey: ColumnKey): string {
    const core = coreColumns.find((col) => col.key === columnKey);
    if (core) return core.label;
    const metaKey = columnKey.slice(5);
    return metadataFieldMap.get(metaKey) ?? metaKey;
  }

  const STATUS_SORT_ORDER: Record<string, number> = {
    active: 0,
    upcoming_renewal: 1,
    expiring: 2,
    expired: 3,
    inactive: 4,
  };

  function getSortValue(
    contract: ContractWithDetails,
    columnKey: ColumnKey
  ): string | number {
    switch (columnKey) {
      case "contract_id":
        return contract.contract_number ?? Number.MAX_SAFE_INTEGER;
      case "title":
        return (
          contract.display_name ?? contract.title ?? ""
        ).toLowerCase();
      case "legal_entity":
        return metadataValue(contract, "legal_entity").toLowerCase();
      case "counterparty":
        return metadataValue(contract, "counterparty").toLowerCase();
      case "status":
        return STATUS_SORT_ORDER[contract.effective_status] ?? 99;
      case "review":
        return contract.pending_review_count;
      default: {
        const raw = metadataValue(contract, columnKey.slice(5));
        if (raw === "—") return "";
        const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return iso[0];
        const parsed = Date.parse(raw);
        if (!Number.isNaN(parsed) && /\d/.test(raw)) return parsed;
        return raw.toLowerCase();
      }
    }
  }

  function compareSortValues(
    av: string | number,
    bv: string | number,
    direction: "asc" | "desc"
  ): number {
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    }
    return direction === "asc" ? cmp : -cmp;
  }

  function toggleColumnSort(columnKey: ColumnKey) {
    if (sortColumn === columnKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  }

  function renderCell(contract: ContractWithDetails, columnKey: ColumnKey) {
    switch (columnKey) {
      case "contract_id":
        return contract.contract_number ?? "—";
      case "title":
        return (
          <Link
            href={`/contracts/${contract.id}`}
            className="font-medium text-primary hover:underline"
          >
            {contract.display_name ?? contract.title ?? "Untitled"}
          </Link>
        );
      case "legal_entity":
        return metadataValue(contract, "legal_entity");
      case "counterparty":
        return metadataValue(contract, "counterparty");
      case "status":
        return <StatusChip status={contract.effective_status} />;
      case "review":
        return contract.pending_review_count > 0 ? (
          <span className="text-warning">{contract.pending_review_count} pending</span>
        ) : (
          <span className="text-success">Done</span>
        );
      default:
        return metadataValue(contract, columnKey.slice(5));
    }
  }

  const sortedContracts = useMemo(() => {
    const sorted = [...contracts];
    sorted.sort((a, b) => {
      const av = getSortValue(a, sortColumn);
      const bv = getSortValue(b, sortColumn);
      return compareSortValues(av, bv, sortDirection);
    });
    return sorted;
  }, [contracts, sortColumn, sortDirection]);

  const allSelected =
    selectable &&
    contracts.length > 0 &&
    contracts.every((c) => selectedIds?.has(c.id));

  function toggleAll() {
    if (!onSelectedIdsChange) return;
    if (allSelected) {
      onSelectedIdsChange(new Set());
      return;
    }
    onSelectedIdsChange(new Set(contracts.map((c) => c.id)));
  }

  function toggleOne(contractId: string) {
    if (!onSelectedIdsChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(contractId)) next.delete(contractId);
    else next.add(contractId);
    onSelectedIdsChange(next);
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading contracts...</p>;
  }

  if (!contracts.length) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted">No contracts yet.</p>
        <Link
          href="/upload"
          className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
        >
          Upload your first contract
        </Link>
      </Card>
    );
  }

  const toolbarBtn = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 transition-all duration-200",
      active
        ? "border-primary/40 bg-primary/10 text-primary"
        : "border-border bg-card text-muted hover:bg-accent hover:text-foreground"
    );

  const chipBtn = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-all duration-200",
      active
        ? "border-primary/40 bg-primary/10 text-primary"
        : "border-border bg-card text-foreground"
    );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-2 bg-accent/30 py-2">
        <button
          type="button"
          onClick={() => setRearrangeMode((v) => !v)}
          className={toolbarBtn(rearrangeMode)}
        >
          <GripVertical className="mr-1 inline h-3 w-3" />
          Re-arrange
        </button>
        <button
          type="button"
          onClick={() => setSortMode((v) => !v)}
          className={toolbarBtn(sortMode)}
        >
          <ArrowUpDown className="mr-1 inline h-3 w-3" />
          Sort
        </button>
        {rearrangeMode && (
          <select
            className="rounded-full border border-dashed border-border bg-card px-3 py-1 text-xs text-muted"
            defaultValue=""
            onChange={(e) => {
              addColumn(e.target.value);
              e.currentTarget.value = "";
            }}
          >
            <option value="">+ Add column</option>
            {availableColumns.map((col) => (
              <option key={col.key} value={col.key}>
                {col.label}
              </option>
            ))}
          </select>
        )}
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="min-w-max w-full text-left text-sm">
          <thead className="border-b border-border bg-accent/20">
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all contracts"
                    className="rounded border-border"
                  />
                </th>
              )}
              {showFolderPaths && (
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">
                  Location
                </th>
              )}
              {activeColumns.map((key, index) => (
                <th key={key} className="px-2 py-2">
                  <div
                    draggable={rearrangeMode}
                    onDragStart={() => rearrangeMode && setDraggingColumn(key)}
                    onDragOver={(e) => rearrangeMode && e.preventDefault()}
                    onDrop={(e) => {
                      if (!rearrangeMode) return;
                      e.preventDefault();
                      if (draggingColumn) moveColumnToTarget(draggingColumn, key);
                      setDraggingColumn(null);
                    }}
                    onDragEnd={() => rearrangeMode && setDraggingColumn(null)}
                    className={chipBtn(draggingColumn === key)}
                    title="Drag to reorder"
                  >
                    {rearrangeMode && (
                      <GripVertical className="h-3 w-3 cursor-grab text-muted" />
                    )}
                    <span>{columnLabel(key)}</span>
                    {sortMode && (
                      <button
                        type="button"
                        onClick={() => toggleColumnSort(key)}
                        className={cn(
                          "rounded-full border px-1.5 py-0.5 transition-colors",
                          sortColumn === key
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border text-muted hover:text-foreground"
                        )}
                        title={`Sort by ${columnLabel(key)}`}
                      >
                        {sortColumn === key ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    )}
                    {rearrangeMode && (
                      <>
                        <button
                          type="button"
                          onClick={() => moveColumn(key, -1)}
                          disabled={index === 0}
                          className="text-muted disabled:opacity-30"
                          title="Move left"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveColumn(key, 1)}
                          disabled={index === activeColumns.length - 1}
                          className="text-muted disabled:opacity-30"
                          title="Move right"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeColumn(key)}
                          className="text-danger"
                          title="Remove column"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedContracts.map((contract) => (
              <tr
                key={contract.id}
                className="transition-colors hover:bg-accent/30"
              >
                {selectable && (
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(contract.id) ?? false}
                      onChange={() => toggleOne(contract.id)}
                      aria-label={`Select contract ${contract.contract_number ?? contract.id}`}
                      className="rounded border-border"
                    />
                  </td>
                )}
                {showFolderPaths && (
                  <td className="px-4 py-3 align-top">
                    <ContractFolderPaths contract={contract} />
                  </td>
                )}
                {activeColumns.map((key) => (
                  <td key={key} className="px-4 py-3 text-muted">
                    {renderCell(contract, key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function MetricCards({ contracts }: { contracts: ContractWithDetails[] }) {
  const total = contracts.length;
  const dueSoon = contracts.filter(
    (c) =>
      c.effective_status === "expiring" ||
      c.effective_status === "upcoming_renewal"
  ).length;
  const pendingReview = contracts.reduce(
    (sum, c) => sum + c.pending_review_count,
    0
  );

  const cards = [
    {
      label: "Total contracts",
      value: total,
      icon: FileText,
      accent: "text-primary bg-primary/10",
    },
    {
      label: "Due soon",
      value: dueSoon,
      icon: Timer,
      accent: "text-warning bg-warning/10",
    },
    {
      label: "Fields to review",
      value: pendingReview,
      icon: ClipboardList,
      accent: "text-danger bg-danger/10",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.3 }}
          >
            <Card hover className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {card.value}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    card.accent
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

export function OnionFilter({
  contracts,
  onFilterChange,
}: {
  contracts: ContractWithDetails[];
  onFilterChange: (params: URLSearchParams) => void;
}) {
  const [fields, setFields] = useState<
    { key: string; label: string; category: string }[]
  >([]);
  const [category, setCategory] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldValue, setFieldValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    fetch("/api/metadata-fields")
      .then((r) => r.json())
      .then((data) => setFields(data.fields ?? []));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const categories = [...new Set(fields.map((f) => f.category))];
  const categoryFields = fields.filter((f) => f.category === category);
  const fieldValueOptions = useMemo(() => {
    if (!fieldKey) return [];

    const values = new Set<string>();
    for (const contract of contracts) {
      if (fieldKey === "counterparty" && contract.counterparty?.name) {
        values.add(contract.counterparty.name);
      }
      if (fieldKey === "legal_entity" && contract.legal_entity?.name) {
        values.add(contract.legal_entity.name);
      }

      for (const mv of contract.metadata_values) {
        if (mv.metadata_fields?.key === fieldKey && mv.value?.trim()) {
          values.add(mv.value.trim());
        }
      }
    }

    const query = fieldValue.trim().toLowerCase();
    return [...values]
      .sort((a, b) => a.localeCompare(b))
      .filter((value) => !query || value.toLowerCase().includes(query));
  }, [contracts, fieldKey, fieldValue]);

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter.length) params.set("status", statusFilter.join(","));
    if (fieldKey && fieldValue) params.set(`field:${fieldKey}`, fieldValue);
    if (debouncedSearch) params.set("search", debouncedSearch);
    onFilterChange(params);
  }, [statusFilter, fieldKey, fieldValue, debouncedSearch, onFilterChange]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  function toggleStatus(status: string) {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <Card>
      <CardContent>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Search className="h-4 w-4 text-muted" />
          Filters
        </h3>

        <input
          type="text"
          placeholder="Search title or counterparty..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(inputClass, "mb-3")}
        />

        <div className="mb-3 flex flex-wrap gap-2">
          {STATUS_FILTER_OPTIONS.map((s) => {
            const selected = statusFilter.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200",
                  statusChipStyles[s],
                  selected
                    ? "ring-2 ring-offset-1 ring-offset-background ring-current"
                    : "opacity-60 hover:opacity-100"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", statusDotStyles[s])} />
                {statusLabels[s]}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setFieldKey("");
            }}
            className={inputClass}
          >
            <option value="">Category</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={fieldKey}
            onChange={(e) => {
              setFieldKey(e.target.value);
              setFieldValue("");
            }}
            disabled={!category}
            className={cn(inputClass, "disabled:opacity-50")}
          >
            <option value="">Field</option>
            {categoryFields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Value"
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            list="field-value-options"
            disabled={!fieldKey}
            className={cn(inputClass, "disabled:opacity-50")}
          />
          <datalist id="field-value-options">
            {fieldValueOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>
      </CardContent>
    </Card>
  );
}

export function AskBox() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setAnswer(null);

    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    setAnswer(data.answer ?? data.error);
    setLoading(false);
  }

  return (
    <Card>
      <CardContent>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Ask about contracts
        </h3>
        <form onSubmit={handleAsk} className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Which contracts expire this quarter?"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button type="submit" disabled={loading} size="md">
            {loading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                ...
              </>
            ) : (
              "Ask"
            )}
          </Button>
        </form>
        {answer && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{answer}</p>
        )}
      </CardContent>
    </Card>
  );
}
