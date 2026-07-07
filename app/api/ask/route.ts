import { NextResponse } from "next/server";
import { structuredAsk } from "@/lib/qa/structured-ask";
import { requireAuth } from "@/lib/api/auth";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { question } = await request.json();
  if (!question) {
    return NextResponse.json({ error: "Question required" }, { status: 400 });
  }

  try {
    const result = await structuredAsk(question);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Ask failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ask failed" },
      { status: 500 }
    );
  }
}
