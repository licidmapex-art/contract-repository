"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import {
  AskBox,
  ContractTable,
  MetricCards,
  OnionFilter,
} from "@/components/contracts/Dashboard";
import { BulkEditBar } from "@/components/contracts/BulkEditBar";
import { DashboardCharts } from "@/components/contracts/DashboardCharts";
import { Button } from "@/components/ui/Button";
import { applyDashboardFilters } from "@/lib/folders/filter-contracts";
import { ContractWithDetails } from "@/lib/types";

export default function DashboardPage() {
  const [allContracts, setAllContracts] = useState<ContractWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterParams, setFilterParams] = useState<URLSearchParams>(
    new URLSearchParams()
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadContracts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await fetch("/api/contracts");
    const data = await res.json();
    setAllContracts(data.contracts ?? []);
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  const handleFilterChange = useCallback((params: URLSearchParams) => {
    setFilterParams(new URLSearchParams(params.toString()));
  }, []);

  const displayContracts = useMemo(
    () =>
      applyDashboardFilters(allContracts, {
        searchParams: filterParams,
      }),
    [allContracts, filterParams]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Link href="/upload">
          <Button icon={<Upload className="h-4 w-4" />}>Upload contract</Button>
        </Link>
      </div>

      <MetricCards contracts={displayContracts} />
      <DashboardCharts />

      <div className="space-y-4">
        <OnionFilter contracts={allContracts} onFilterChange={handleFilterChange} />
        <AskBox />
        <BulkEditBar
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds(new Set())}
          onComplete={() => loadContracts(true)}
        />
        <ContractTable
          contracts={displayContracts}
          loading={loading}
          selectable
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
        />
      </div>
    </div>
  );
}
