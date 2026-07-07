import { NextResponse } from "next/server";
import { pollGmailInbox } from "@/lib/gmail/poll-inbox";

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await pollGmailInbox();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Gmail poll cron failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Poll failed" },
      { status: 500 }
    );
  }
}
