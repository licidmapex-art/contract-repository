import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllFolders } from "@/lib/folders/db";
import { buildFolderPathLabel } from "@/lib/folders/match";
import { FolderRecord } from "@/lib/folders/navigation";

export async function fetchContractFolderIds(
  contractId: string
): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contract_folders")
    .select("folder_id")
    .eq("contract_id", contractId);

  if (error) {
    if (error.message.includes("contract_folders")) {
      return fallbackFolderId(contractId);
    }
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.folder_id as string);
}

async function fallbackFolderId(contractId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("contracts")
    .select("folder_id")
    .eq("id", contractId)
    .maybeSingle();

  return data?.folder_id ? [data.folder_id as string] : [];
}

export async function fetchFolderIdsByContractIds(
  contractIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!contractIds.length) return map;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contract_folders")
    .select("contract_id, folder_id")
    .in("contract_id", contractIds);

  if (error) {
    if (!error.message.includes("contract_folders")) {
      throw new Error(error.message);
    }
    for (const contractId of contractIds) {
      map.set(contractId, await fallbackFolderId(contractId));
    }
    return map;
  }

  for (const contractId of contractIds) {
    map.set(contractId, []);
  }
  for (const row of data ?? []) {
    const list = map.get(row.contract_id as string) ?? [];
    list.push(row.folder_id as string);
    map.set(row.contract_id as string, list);
  }
  return map;
}

export function buildFolderPaths(
  folderIds: string[],
  folders: FolderRecord[]
): string[] {
  return folderIds
    .map((id) => buildFolderPathLabel(id, folders))
    .filter((path): path is string => Boolean(path))
    .sort((a, b) => a.localeCompare(b));
}

export async function addContractFolder(
  contractId: string,
  folderId: string
): Promise<string[]> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("contract_folders")
    .upsert(
      { contract_id: contractId, folder_id: folderId },
      { onConflict: "contract_id,folder_id", ignoreDuplicates: true }
    );

  if (error) {
    if (error.message.includes("contract_folders")) {
      await supabase
        .from("contracts")
        .update({ folder_id: folderId })
        .eq("id", contractId);
      return [folderId];
    }
    throw new Error(error.message);
  }

  const folderIds = await fetchContractFolderIds(contractId);
  await syncActivityFolderMetadataFromIds(contractId, folderIds);
  return folderIds;
}

export async function removeContractFolder(
  contractId: string,
  folderId: string
): Promise<string[]> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("contract_folders")
    .delete()
    .eq("contract_id", contractId)
    .eq("folder_id", folderId);

  if (error) {
    if (error.message.includes("contract_folders")) {
      await supabase
        .from("contracts")
        .update({ folder_id: null })
        .eq("id", contractId)
        .eq("folder_id", folderId);
      return [];
    }
    throw new Error(error.message);
  }

  const folderIds = await fetchContractFolderIds(contractId);
  await syncActivityFolderMetadataFromIds(contractId, folderIds);
  return folderIds;
}

export async function setContractFolders(
  contractId: string,
  folderIds: string[]
): Promise<string[]> {
  const uniqueIds = [...new Set(folderIds)];
  const supabase = createAdminClient();

  const { error: deleteError } = await supabase
    .from("contract_folders")
    .delete()
    .eq("contract_id", contractId);

  if (deleteError && !deleteError.message.includes("contract_folders")) {
    throw new Error(deleteError.message);
  }

  if (uniqueIds.length) {
    const { error: insertError } = await supabase.from("contract_folders").insert(
      uniqueIds.map((folderId) => ({
        contract_id: contractId,
        folder_id: folderId,
      }))
    );

    if (insertError) {
      if (insertError.message.includes("contract_folders")) {
        await supabase
          .from("contracts")
          .update({ folder_id: uniqueIds[0] ?? null })
          .eq("id", contractId);
        return uniqueIds.slice(0, 1);
      }
      throw new Error(insertError.message);
    }
  } else if (deleteError?.message.includes("contract_folders")) {
    await supabase
      .from("contracts")
      .update({ folder_id: null })
      .eq("id", contractId);
  }

  await syncActivityFolderMetadataFromIds(contractId, uniqueIds);
  return uniqueIds;
}

export async function syncActivityFolderMetadataFromIds(
  contractId: string,
  folderIds: string[]
): Promise<void> {
  const supabase = createAdminClient();

  const { data: field } = await supabase
    .from("metadata_fields")
    .select("id")
    .eq("key", "activity_folder")
    .maybeSingle();

  if (!field) return;

  const folders = await fetchAllFolders();
  const paths = buildFolderPaths(folderIds, folders);
  const value = paths.length ? paths.join("; ") : null;

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
        value,
        confidence: value ? 1 : null,
        confirmed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return;
  }

  if (value) {
    await supabase.from("metadata_values").insert({
      contract_id: contractId,
      field_id: field.id,
      value,
      confidence: 1,
      confirmed: true,
    });
  }
}

export async function getContractIdsInFolderSubtree(
  folderId: string,
  folders: FolderRecord[]
): Promise<string[]> {
  const { buildDescendantsMap } = await import("@/lib/folders/navigation");
  const descendants = buildDescendantsMap(folders);
  const folderIds = [...(descendants.get(folderId) ?? new Set([folderId]))];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contract_folders")
    .select("contract_id")
    .in("folder_id", folderIds);

  if (error) {
    if (error.message.includes("contract_folders")) {
      const { data: legacy } = await supabase
        .from("contracts")
        .select("id")
        .in("folder_id", folderIds);
      return [...new Set((legacy ?? []).map((row) => row.id as string))];
    }
    throw new Error(error.message);
  }

  return [...new Set((data ?? []).map((row) => row.contract_id as string))];
}
