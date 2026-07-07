import { NextResponse } from "next/server";
import {
  getSupabaseEnvStatus,
  hasSupabasePublicEnv,
  SUPABASE_ENV_MESSAGE,
} from "@/lib/supabase/env";

export async function GET() {
  const status = getSupabaseEnvStatus();
  return NextResponse.json({
    configured: hasSupabasePublicEnv(),
    message: hasSupabasePublicEnv() ? "ok" : SUPABASE_ENV_MESSAGE,
    ...status,
  });
}
