import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { fetchContractSummaries } from "@/lib/contracts/fetch";

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const contracts = await fetchContractSummaries();
  return NextResponse.json({ contracts });
}
