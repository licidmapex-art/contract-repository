import { syncFolderMetadataFromAssignment } from "@/lib/folders/link-contract-folder";
import { getContractIdsInFolderSubtree } from "@/lib/folders/contract-folders";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildDescendantsMap,
  FolderRecord,
  getInvalidMoveTargets as blockedMoveTargets,
} from "@/lib/folders/navigation";

export async function fetchAllFolders(): Promise<FolderRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("folders")
    .select("id, name, parent_id, sort_order")
    .order("sort_order")
    .order("name");

  if (error) {
    if (error.message.includes("folders")) return [];
    if (error.message.includes("sort_order")) {
      const fallback = await supabase
        .from("folders")
        .select("id, name, parent_id")
        .order("name");
      if (fallback.error) throw new Error(fallback.error.message);
      return (fallback.data ?? []).map((row) => ({
        ...row,
        sort_order: 0,
      }));
    }
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    parent_id: row.parent_id,
    sort_order: row.sort_order ?? 0,
  }));
}

async function nextSiblingSortOrder(parentId: string | null): Promise<number> {
  const supabase = createAdminClient();
  let query = supabase.from("folders").select("sort_order");

  query =
    parentId === null
      ? query.is("parent_id", null)
      : query.eq("parent_id", parentId);

  const { data } = await query;
  const orders = (data ?? []).map((row) => row.sort_order ?? 0);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

export async function createFolder(
  name: string,
  parentId: string | null
): Promise<FolderRecord> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name is required");

  const supabase = createAdminClient();

  let siblingsQuery = supabase
    .from("folders")
    .select("id, name")
    .ilike("name", trimmed);

  siblingsQuery =
    parentId === null
      ? siblingsQuery.is("parent_id", null)
      : siblingsQuery.eq("parent_id", parentId);

  const { data: siblings } = await siblingsQuery;
  if ((siblings ?? []).length > 0) {
    throw new Error("A folder with this name already exists here");
  }

  if (parentId) {
    const { data: parent } = await supabase
      .from("folders")
      .select("id")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent) throw new Error("Parent folder not found");
  }

  const sortOrder = await nextSiblingSortOrder(parentId);

  const { data, error } = await supabase
    .from("folders")
    .insert({ name: trimmed, parent_id: parentId, sort_order: sortOrder })
    .select("id, name, parent_id, sort_order")
    .single();

  if (error) throw new Error(error.message);
  return {
    ...data,
    sort_order: data.sort_order ?? sortOrder,
  };
}

async function resyncContractsInFolderSubtree(
  folderId: string,
  folders: FolderRecord[]
) {
  const contractIds = await getContractIdsInFolderSubtree(folderId, folders);
  const { fetchContractFolderIds, syncActivityFolderMetadataFromIds } =
    await import("@/lib/folders/contract-folders");

  for (const contractId of contractIds) {
    const folderIds = await fetchContractFolderIds(contractId);
    await syncActivityFolderMetadataFromIds(contractId, folderIds);
  }
}

export async function moveFolder(
  folderId: string,
  newParentId: string | null
): Promise<FolderRecord> {
  const folders = await fetchAllFolders();
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) throw new Error("Folder not found");

  if (newParentId === folderId) {
    throw new Error("A folder cannot be moved into itself");
  }

  if (newParentId) {
    const invalid = blockedMoveTargets(folderId, folders);
    if (invalid.has(newParentId)) {
      throw new Error("A folder cannot be moved into its own subfolder");
    }

    const parent = folders.find((f) => f.id === newParentId);
    if (!parent) throw new Error("Destination folder not found");
  }

  const sibling = folders.find(
    (f) =>
      f.id !== folderId &&
      f.parent_id === newParentId &&
      f.name.localeCompare(folder.name, undefined, { sensitivity: "accent" }) === 0
  );
  if (sibling) {
    throw new Error("A folder with this name already exists in the destination");
  }

  const supabase = createAdminClient();
  const sortOrder = await nextSiblingSortOrder(newParentId);
  const { data, error } = await supabase
    .from("folders")
    .update({ parent_id: newParentId, sort_order: sortOrder })
    .eq("id", folderId)
    .select("id, name, parent_id, sort_order")
    .single();

  if (error) throw new Error(error.message);

  const updatedFolders = await fetchAllFolders();
  await resyncContractsInFolderSubtree(folderId, updatedFolders);

  return data;
}

export async function deleteFolder(folderId: string): Promise<void> {
  const folders = await fetchAllFolders();
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) throw new Error("Folder not found");

  const contractIds = await getContractIdsInFolderSubtree(folderId, folders);
  const supabase = createAdminClient();
  const { error } = await supabase.from("folders").delete().eq("id", folderId);

  if (error) throw new Error(error.message);

  const { syncActivityFolderMetadataFromIds } = await import(
    "@/lib/folders/contract-folders"
  );
  for (const contractId of contractIds) {
    const { fetchContractFolderIds } = await import(
      "@/lib/folders/contract-folders"
    );
    const remaining = (await fetchContractFolderIds(contractId)).filter(
      (id) => id !== folderId
    );
    await syncActivityFolderMetadataFromIds(contractId, remaining);
  }
}

export async function syncActivityFolderMetadata(
  contractId: string,
  folderId: string | null
) {
  await syncFolderMetadataFromAssignment(contractId, folderId);
}

export async function reorderFolders(
  parentId: string | null,
  orderedIds: string[]
): Promise<void> {
  if (!orderedIds.length) return;

  const supabase = createAdminClient();
  const folders = await fetchAllFolders();
  const siblings = folders.filter((folder) => folder.parent_id === parentId);
  const siblingIds = new Set(siblings.map((folder) => folder.id));

  for (const id of orderedIds) {
    if (!siblingIds.has(id)) {
      throw new Error("All folders must be siblings of the same parent");
    }
  }

  if (orderedIds.length !== siblings.length) {
    throw new Error("Reorder must include every folder at this level");
  }

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("folders").update({ sort_order: index }).eq("id", id)
    )
  );
}
