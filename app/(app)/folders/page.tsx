"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AskBox,
  ContractTable,
  OnionFilter,
} from "@/components/contracts/Dashboard";
import { FolderBrowser } from "@/components/contracts/FolderBrowser";
import { Card } from "@/components/ui/Card";
import { applyDashboardFilters } from "@/lib/folders/filter-contracts";
import { FolderPath, FolderRecord } from "@/lib/folders/navigation";
import { ContractWithDetails } from "@/lib/types";

export default function FoldersPage() {
  const [allContracts, setAllContracts] = useState<ContractWithDetails[]>([]);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [folderPath, setFolderPath] = useState<FolderPath>([]);
  const [filterParams, setFilterParams] = useState<URLSearchParams>(
    new URLSearchParams()
  );

  const loadContracts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/contracts");
    const data = await res.json();
    setAllContracts(data.contracts ?? []);
    setLoading(false);
  }, []);

  const loadFolders = useCallback(async () => {
    const res = await fetch("/api/folders");
    const data = await res.json();
    setFolders(data.folders ?? []);
  }, []);

  useEffect(() => {
    loadContracts();
    loadFolders();
  }, [loadContracts, loadFolders]);

  const handleFilterChange = useCallback((params: URLSearchParams) => {
    setFilterParams(new URLSearchParams(params.toString()));
  }, []);

  const displayContracts = useMemo(
    () =>
      applyDashboardFilters(allContracts, {
        folderPath,
        folders,
        searchParams: filterParams,
      }),
    [allContracts, folderPath, folders, filterParams]
  );

  return (
    <Card className="flex min-h-[calc(100vh-8rem)] overflow-hidden p-0">
      <FolderBrowser
        contracts={allContracts}
        path={folderPath}
        onPathChange={setFolderPath}
        onFoldersUpdated={loadContracts}
      />
      <div className="min-w-0 flex-1 space-y-4 overflow-auto p-4">
        <OnionFilter onFilterChange={handleFilterChange} />
        <AskBox />
        <ContractTable
          contracts={displayContracts}
          loading={loading}
          showFolderPaths
        />
      </div>
    </Card>
  );
}
