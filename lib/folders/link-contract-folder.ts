import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllFolders } from "@/lib/folders/db";
import {
  addContractFolder,
  syncActivityFolderMetadataFromIds,
} from "@/lib/folders/contract-folders";
import {
  buildFolderPathLabel,
  folderExtractionConfirmed,
  resolveFolderIdFromPath,
} from "@/lib/folders/match";
import { ExtractedField } from "@/lib/gemini/extract";

function parseFolderPaths(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function linkContractFolder(
  contractId: string,
  extracted: ExtractedField[]
): Promise<void> {
  const item = extracted.find((field) => field.key === "activity_folder");
  if (!item?.value?.trim() || !folderExtractionConfirmed(item.confidence)) {
    return;
  }

  const folders = await fetchAllFolders();
  const folderId = resolveFolderIdFromPath(item.value, folders);
  if (!folderId) return;

  await addContractFolder(contractId, folderId);
}

export async function applyFolderFromMetadataValue(
  contractId: string,
  value: string | null
): Promise<void> {
  const folders = await fetchAllFolders();
  const paths = parseFolderPaths(value);

  for (const path of paths) {
    const folderId = resolveFolderIdFromPath(path, folders);
    if (folderId) {
      await addContractFolder(contractId, folderId);
    }
  }
}

export async function syncFolderMetadataFromAssignment(
  contractId: string,
  folderId: string | null
): Promise<void> {
  if (folderId) {
    await addContractFolder(contractId, folderId);
    return;
  }

  const supabase = createAdminClient();
  const { data: field } = await supabase
    .from("metadata_fields")
    .select("id")
    .eq("key", "activity_folder")
    .maybeSingle();

  if (!field) return;

  const { data: existing } = await supabase
    .from("metadata_values")
    .select("id")
    .eq("contract_id", contractId)
    .eq("field_id", field.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("metadata_values")
      .update({
        value: null,
        confidence: null,
        confirmed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  }
}

export async function syncFoldersMetadataFromIds(
  contractId: string,
  folderIds: string[]
): Promise<void> {
  await syncActivityFolderMetadataFromIds(contractId, folderIds);
}

export function buildFolderMetadataValue(
  folderIds: string[],
  folders: { id: string; name: string; parent_id: string | null }[]
): string | null {
  const paths = folderIds
    .map((id) => buildFolderPathLabel(id, folders))
    .filter((path): path is string => Boolean(path))
    .sort((a, b) => a.localeCompare(b));
  return paths.length ? paths.join("; ") : null;
}
