import { NextResponse } from "next/server";
import { getFoldersSetupStatus } from "@/lib/folders/db";
import {
  getSupabaseEnvStatus,
  hasSupabasePublicEnv,
  SUPABASE_ENV_MESSAGE,
} from "@/lib/supabase/env";

export async function GET() {
  const status = getSupabaseEnvStatus();
  const folders = hasSupabasePublicEnv()
    ? await getFoldersSetupStatus()
  : {
      tableReady: false,
      folderCount: 0,
      hasSortOrder: false,
      hasContractFolders: false,
      contractFolderLinkCount: 0,
      message: null,
    };

  return NextResponse.json({
    configured: hasSupabasePublicEnv(),
    message: hasSupabasePublicEnv() ? "ok" : SUPABASE_ENV_MESSAGE,
    ...status,
    folders,
  });
}
