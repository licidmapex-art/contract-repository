import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { fetchAllContractsWithDetails } from "@/lib/contracts/fetch";
import {
  matchesFieldFilters,
  matchesStatusFilter,
  parseFieldFilters,
  parseListParam,
} from "@/lib/filters/build-query";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { searchParams } = request.nextUrl;
  const statusFilter = parseListParam(searchParams.get("status"));
  const fieldFilters = parseFieldFilters(searchParams);
  const search = searchParams.get("search")?.toLowerCase();

  let contracts = await fetchAllContractsWithDetails();

  if (statusFilter.length > 0) {
    contracts = contracts.filter((c) =>
      matchesStatusFilter(c.effective_status, statusFilter)
    );
  }

  if (Object.keys(fieldFilters).length > 0) {
    contracts = contracts.filter((c) =>
      matchesFieldFilters(c.metadata_values, fieldFilters)
    );
  }

  if (search) {
    contracts = contracts.filter((c) => {
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

  return NextResponse.json({ contracts });
}
