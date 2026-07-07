import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { confirmMetadataValue } from "@/lib/metadata/confirm-value";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { id: contractId, fieldId } = await params;
  const body = await request.json();
  const { value } = body as { value: string | null };

  try {
    const metadata_value = await confirmMetadataValue({
      contractId,
      fieldId,
      value,
      userId: auth.user!.id,
      userEmail: auth.user!.email ?? null,
    });

    return NextResponse.json({ metadata_value });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Confirm failed" },
      { status: 500 }
    );
  }
}
