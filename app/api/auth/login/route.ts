import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabasePublicEnv, SUPABASE_ENV_MESSAGE } from "@/lib/supabase/env";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: SUPABASE_ENV_MESSAGE }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      {
        error:
          "Could not reach Supabase. Check your project is active at supabase.com/dashboard and your URL/key in .env.local.",
      },
      { status: 503 }
    );
  }
}
