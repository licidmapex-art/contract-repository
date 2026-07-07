import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { fetchContractWithDetails } from "@/lib/contracts/fetch";
import { askSingleContract } from "@/lib/gemini/contract-ask";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { question } = (await request.json()) as { question?: string };
  if (!question?.trim()) {
    return NextResponse.json({ error: "Question required" }, { status: 400 });
  }

  const { id } = await params;
  const contract = await fetchContractWithDetails(id);
  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  try {
    const metadata = Object.fromEntries(
      contract.metadata_values.map((v) => [v.metadata_fields?.key ?? "unknown", v.value])
    );
    const extractedText = contract.documents
      .map((doc) => doc.extracted_text ?? "")
      .join("\n\n---\n\n");

    const answer = await askSingleContract(question, {
      metadata,
      extractedText,
    });

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Contract ask failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to answer question",
      },
      { status: 500 }
    );
  }
}
