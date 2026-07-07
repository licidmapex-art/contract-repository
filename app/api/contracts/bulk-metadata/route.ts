import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import {
  addContractFolder,
  buildFolderPaths,
  fetchContractFolderIds,
  removeContractFolder,
  setContractFolders,
  syncActivityFolderMetadataFromIds,
} from "@/lib/folders/contract-folders";
import { confirmMetadataValue } from "@/lib/metadata/confirm-value";
import { fetchAllFolders } from "@/lib/folders/db";
import { resolveFolderIdFromPath } from "@/lib/folders/match";
import { createAdminClient } from "@/lib/supabase/admin";
import { BulkFolderUpdate, BulkMetadataUpdate } from "@/lib/types";

function parseFolderPaths(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

async function applyActivityFolderMetadataUpdate(
  contractId: string,
  value: string | null,
  mode: "set" | "add"
) {
  const folders = await fetchAllFolders();
  const paths = parseFolderPaths(value);
  const folderIds = paths
    .map((path) => resolveFolderIdFromPath(path, folders))
    .filter((id): id is string => Boolean(id));

  if (mode === "set") {
    await setContractFolders(contractId, folderIds);
    return;
  }

  for (const folderId of folderIds) {
    await addContractFolder(contractId, folderId);
  }

  if (!folderIds.length && value === null) {
    await setContractFolders(contractId, []);
    await syncActivityFolderMetadataFromIds(contractId, []);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const body = await request.json();
  const contractIds = (body.contractIds as string[] | undefined)?.filter(Boolean) ?? [];
  const metadataUpdates = (body.metadataUpdates as BulkMetadataUpdate[] | undefined) ?? [];
  const folderUpdates = (body.folderUpdates as BulkFolderUpdate[] | undefined) ?? [];

  if (!contractIds.length) {
    return NextResponse.json({ error: "No contracts selected" }, { status: 400 });
  }

  if (!metadataUpdates.length && !folderUpdates.length) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const results: { contractId: string; ok: boolean; error?: string }[] = [];

  for (const contractId of contractIds) {
    try {
      for (const folderUpdate of folderUpdates) {
        if (folderUpdate.mode === "add") {
          await addContractFolder(contractId, folderUpdate.folderId);
        } else if (folderUpdate.mode === "remove") {
          await removeContractFolder(contractId, folderUpdate.folderId);
        } else {
          await setContractFolders(contractId, [folderUpdate.folderId]);
        }
      }

      for (const update of metadataUpdates) {
        const { data: field } = await supabase
          .from("metadata_fields")
          .select("key")
          .eq("id", update.fieldId)
          .maybeSingle();

        if (field?.key === "activity_folder") {
          await applyActivityFolderMetadataUpdate(
            contractId,
            update.value,
            update.mode === "add" ? "add" : "set"
          );
          const folderIds = await fetchContractFolderIds(contractId);
          const folders = await fetchAllFolders();
          const syncedValue =
            buildFolderPaths(folderIds, folders).join("; ") || null;
          await confirmMetadataValue({
            contractId,
            fieldId: update.fieldId,
            value: syncedValue,
            userId: auth.user!.id,
            userEmail: auth.user!.email ?? null,
            skipFolderSideEffect: true,
          });
          continue;
        }

        if (update.mode === "add") {
          const { data: existing } = await supabase
            .from("metadata_values")
            .select("value")
            .eq("contract_id", contractId)
            .eq("field_id", update.fieldId)
            .maybeSingle();

          if (existing?.value?.trim() && update.value?.trim()) {
            const combined = `${existing.value}; ${update.value}`;
            await confirmMetadataValue({
              contractId,
              fieldId: update.fieldId,
              value: combined,
              userId: auth.user!.id,
              userEmail: auth.user!.email ?? null,
            });
          } else if (!existing?.value?.trim()) {
            await confirmMetadataValue({
              contractId,
              fieldId: update.fieldId,
              value: update.value,
              userId: auth.user!.id,
              userEmail: auth.user!.email ?? null,
            });
          }
        } else {
          await confirmMetadataValue({
            contractId,
            fieldId: update.fieldId,
            value: update.value,
            userId: auth.user!.id,
            userEmail: auth.user!.email ?? null,
          });
        }
      }

      results.push({ contractId, ok: true });
    } catch (error) {
      results.push({
        contractId,
        ok: false,
        error: error instanceof Error ? error.message : "Update failed",
      });
    }
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    updated: results.filter((r) => r.ok).length,
    failed: failed.length,
    results,
  });
}
