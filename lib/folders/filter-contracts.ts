import {
  matchesFieldFilters,
  matchesStatusFilter,
  parseFieldFilters,
  parseListParam,
} from "@/lib/filters/build-query";
import { ContractWithDetails } from "@/lib/types";
import {
  filterContractsByFolderPath,
  FolderPath,
  FolderRecord,
} from "@/lib/folders/navigation";

export function applyDashboardFilters(
  contracts: ContractWithDetails[],
  options: {
    folderPath?: FolderPath;
    folders?: FolderRecord[];
    searchParams?: URLSearchParams;
  }
): ContractWithDetails[] {
  let result = contracts;

  if (options.folderPath?.length && options.folders) {
    result = filterContractsByFolderPath(
      result,
      options.folders,
      options.folderPath
    );
  }

  const params = options.searchParams;
  if (!params) return result;

  const statusFilter = parseListParam(params.get("status"));
  const fieldFilters = parseFieldFilters(params);
  const search = params.get("search")?.toLowerCase();

  if (statusFilter.length > 0) {
    result = result.filter((c) =>
      matchesStatusFilter(c.effective_status, statusFilter)
    );
  }

  if (Object.keys(fieldFilters).length > 0) {
    result = result.filter((c) =>
      matchesFieldFilters(c.metadata_values, fieldFilters)
    );
  }

  if (search) {
    result = result.filter((c) => {
      const title = (c.display_name ?? c.title ?? "").toLowerCase();
      const counterparty =
        c.counterparty?.name?.toLowerCase() ??
        c.metadata_values
          .find((v) => v.metadata_fields?.key === "counterparty")
          ?.value?.toLowerCase() ??
        "";
      return title.includes(search) || counterparty.includes(search);
    });
  }

  return result;
}
