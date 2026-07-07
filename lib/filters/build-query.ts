import { EffectiveStatus, FilterClause } from "@/lib/types";
import {
  computeEffectiveStatusFromMetadata,
  getMetadataValue,
} from "@/lib/contracts/status";

export function parseListParam(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export function parseFieldFilters(
  searchParams: URLSearchParams
): Record<string, string> {
  const fieldFilters: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("field:") && value) {
      fieldFilters[key.slice(6)] = value;
    }
  }
  return fieldFilters;
}

export function matchesFieldFilters(
  metadataValues: {
    metadata_fields?: { key: string } | null;
    value: string | null;
    confirmed?: boolean;
  }[],
  fieldFilters: Record<string, string>
): boolean {
  for (const [key, expected] of Object.entries(fieldFilters)) {
    const actual = getMetadataValue(metadataValues, key);
    if (!actual || !actual.toLowerCase().includes(expected.toLowerCase())) {
      return false;
    }
  }
  return true;
}

export function matchesStatusFilter(
  effectiveStatus: EffectiveStatus,
  statusFilter: string[]
): boolean {
  if (statusFilter.length === 0) return true;
  return statusFilter.includes(effectiveStatus);
}

export function applyStructuredFilters(
  contracts: {
    id: string;
    status: "active" | "inactive";
    metadata_values: {
      metadata_fields?: { key: string } | null;
      value: string | null;
    }[];
  }[],
  filters: FilterClause[]
): typeof contracts {
  return contracts.filter((contract) => {
    const effectiveStatus = computeEffectiveStatusFromMetadata(
      contract.status,
      contract.metadata_values
    );

    return filters.every((filter) => {
      if (filter.field === "status") {
        if (filter.op === "=") return effectiveStatus === filter.value;
        if (filter.op === "!=") return effectiveStatus !== filter.value;
        return true;
      }

      const actual = getMetadataValue(contract.metadata_values, filter.field);
      if (!actual) return false;

      switch (filter.op) {
        case "=":
          return actual.toLowerCase() === filter.value.toLowerCase();
        case "!=":
          return actual.toLowerCase() !== filter.value.toLowerCase();
        case "contains":
          return actual.toLowerCase().includes(filter.value.toLowerCase());
        case "<":
          return actual < filter.value;
        case "<=":
          return actual <= filter.value;
        case ">":
          return actual > filter.value;
        case ">=":
          return actual >= filter.value;
        default:
          return true;
      }
    });
  });
}
