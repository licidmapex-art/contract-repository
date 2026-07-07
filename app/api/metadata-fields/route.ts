import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("metadata_fields")
    .select("*")
    .order("category")
    .order("label");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const grouped = (data ?? []).reduce(
    (acc, field) => {
      if (!acc[field.category]) acc[field.category] = [];
      acc[field.category].push(field);
      return acc;
    },
    {} as Record<string, typeof data>
  );

  return NextResponse.json({ fields: data, grouped });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const body = await request.json();
  const { key, label, category, field_type, playbook_prompt, enum_options } =
    body;

  if (!key || !label || !playbook_prompt) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("metadata_fields")
    .insert({
      key,
      label,
      category: category ?? "custom",
      field_type: field_type ?? "text",
      playbook_prompt,
      enum_options: enum_options ?? null,
      is_builtin: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ field: data });
}
