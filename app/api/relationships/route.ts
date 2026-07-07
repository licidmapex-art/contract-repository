import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const body = await request.json();
  const { contract_a_id, contract_b_id, relationship_type } = body;

  if (!contract_a_id || !contract_b_id || !relationship_type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contract_relationships")
    .insert({
      contract_a_id,
      contract_b_id,
      relationship_type,
      confirmed: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ relationship: data });
}
