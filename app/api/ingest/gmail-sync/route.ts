import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { pollGmailInbox } from "@/lib/gmail/poll-inbox";

export async function POST() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  try {
    const result = await pollGmailInbox();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Gmail sync failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
