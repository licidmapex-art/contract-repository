import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseLegalEntitiesExcel } from "@/lib/excel/parse-legal-entities";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseLegalEntitiesExcel(buffer);

  if (!parsed.length) {
    return NextResponse.json(
      { error: "No legal entities found in file. Include a Name column." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("legal_entities")
    .upsert(parsed, { onConflict: "name" })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    imported: data?.length ?? 0,
    legal_entities: data ?? [],
  });
}
