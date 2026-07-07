import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("legal_entities")
    .select("*")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ legal_entities: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const body = await request.json();
  const { name, registration_number, country, vat_number, notes } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("legal_entities")
    .insert({
      name: name.trim(),
      registration_number: registration_number?.trim() || null,
      country: country?.trim() || null,
      vat_number: vat_number?.trim() || null,
      notes: notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ legal_entity: data });
}
