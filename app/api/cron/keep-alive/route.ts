import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { count } = await supabase
    .from("contracts")
    .select("*", { count: "exact", head: true });

  return NextResponse.json({ ok: true, contract_count: count ?? 0 });
}
