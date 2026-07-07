import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { reExtractFieldAcrossContracts } from "@/lib/extraction/re-extract-field";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { fieldId } = await params;

  try {
    const result = await reExtractFieldAcrossContracts(fieldId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Re-extract failed" },
      { status: 500 }
    );
  }
}
