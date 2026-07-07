import { ContractWithDetails } from "@/lib/types";

export const UNASSIGNED_FOLDER_ID = "__unassigned__";
export const UNASSIGNED_FOLDER_LABEL = "Unassigned";

export function getContractFolderIds(contract: ContractWithDetails): string[] {
  if (contract.folder_ids?.length) return contract.folder_ids;
  if (contract.folder_id) return [contract.folder_id];
  return [];
}

export function contractHasFolderInSet(
  contract: ContractWithDetails,
  folderIds: Set<string>
): boolean {
  return getContractFolderIds(contract).some((id) => folderIds.has(id));
}

export interface FolderRecord {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order?: number;
}

export function compareFolderSiblings(a: FolderRecord, b: FolderRecord): number {
  const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
  if (orderDiff !== 0) return orderDiff;
  return a.name.localeCompare(b.name);
}

export function reorderSiblingIds(
  orderedIds: string[],
  dragId: string,
  targetId: string
): string[] {
  if (dragId === targetId) return orderedIds;

  const next = orderedIds.filter((id) => id !== dragId);
  const targetIndex = next.indexOf(targetId);
  if (targetIndex < 0) return orderedIds;

  next.splice(targetIndex, 0, dragId);
  return next;
}

export type FolderPathSegment =
  | { kind: "folder"; id: string; name: string }
  | { kind: "unassigned" };

export type FolderPath = FolderPathSegment[];

export interface FolderChip {
  id: string;
  label: string;
  count: number;
  isUnassigned: boolean;
}

export interface FolderLevelView {
  parentFolderId: string | null;
  chips: FolderChip[];
  atLeaf: boolean;
  contractCount: number;
}

export function buildChildrenMap(
  folders: FolderRecord[]
): Map<string | null, FolderRecord[]> {
  const map = new Map<string | null, FolderRecord[]>();
  for (const folder of folders) {
    const key = folder.parent_id;
    const list = map.get(key) ?? [];
    list.push(folder);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort(compareFolderSiblings);
  }
  return map;
}

export function buildDescendantsMap(
  folders: FolderRecord[]
): Map<string, Set<string>> {
  const children = buildChildrenMap(folders);
  const descendants = new Map<string, Set<string>>();

  function collect(id: string): Set<string> {
    if (descendants.has(id)) return descendants.get(id)!;
    const set = new Set<string>([id]);
    for (const child of children.get(id) ?? []) {
      for (const nested of collect(child.id)) set.add(nested);
    }
    descendants.set(id, set);
    return set;
  }

  for (const folder of folders) collect(folder.id);
  return descendants;
}

export function getParentFolderIdFromPath(path: FolderPath): string | null {
  if (!path.length) return null;
  const last = path[path.length - 1];
  if (last.kind === "unassigned") {
    const parent = path[path.length - 2];
    return parent?.kind === "folder" ? parent.id : null;
  }
  return last.id;
}

export function countContractsInSubtree(
  contracts: ContractWithDetails[],
  folderId: string,
  descendants: Map<string, Set<string>>
): number {
  const ids = descendants.get(folderId) ?? new Set([folderId]);
  return contracts.filter((c) => contractHasFolderInSet(c, ids)).length;
}

export function countUnassignedAtParent(
  contracts: ContractWithDetails[],
  parentFolderId: string | null,
  folders: FolderRecord[]
): number {
  const children = buildChildrenMap(folders);
  const childIds = new Set((children.get(parentFolderId) ?? []).map((f) => f.id));

  return contracts.filter((c) => {
    const tags = getContractFolderIds(c);
    if (!tags.length) return parentFolderId === null;
    if (parentFolderId === null) return false;
    if (!tags.includes(parentFolderId)) return false;
    return !tags.some((id) => childIds.has(id));
  }).length;
}

export function getFolderLevel(
  folders: FolderRecord[],
  contracts: ContractWithDetails[],
  path: FolderPath
): FolderLevelView {
  const children = buildChildrenMap(folders);
  const descendants = buildDescendantsMap(folders);
  const parentFolderId = getParentFolderIdFromPath(path);
  const last = path[path.length - 1];

  if (last?.kind === "unassigned") {
    const unassigned = contracts.filter((c) => {
      const tags = getContractFolderIds(c);
      if (!tags.length) return parentFolderId === null;
      if (parentFolderId === null) return false;
      const childIds = new Set(
        (children.get(parentFolderId) ?? []).map((f) => f.id)
      );
      return tags.includes(parentFolderId) && !tags.some((id) => childIds.has(id));
    });
    return {
      parentFolderId,
      chips: [],
      atLeaf: true,
      contractCount: unassigned.length,
    };
  }

  const childFolders = children.get(parentFolderId) ?? [];
  const chips: FolderChip[] = childFolders.map((folder) => ({
    id: folder.id,
    label: folder.name,
    count: countContractsInSubtree(contracts, folder.id, descendants),
    isUnassigned: false,
  }));

  chips.push({
    id: UNASSIGNED_FOLDER_ID,
    label: UNASSIGNED_FOLDER_LABEL,
    count: countUnassignedAtParent(contracts, parentFolderId, folders),
    isUnassigned: true,
  });

  const contractCount =
    parentFolderId === null
      ? contracts.length
      : countContractsInSubtree(contracts, parentFolderId, descendants);

  return {
    parentFolderId,
    chips,
    atLeaf: false,
    contractCount,
  };
}

export function filterContractsByFolderPath(
  contracts: ContractWithDetails[],
  folders: FolderRecord[],
  path: FolderPath
): ContractWithDetails[] {
  if (!path.length) return contracts;

  const descendants = buildDescendantsMap(folders);
  const last = path[path.length - 1];
  const parentFolderId = getParentFolderIdFromPath(path);

  if (last.kind === "unassigned") {
    const children = buildChildrenMap(folders);
    const childIds = new Set(
      (children.get(parentFolderId) ?? []).map((f) => f.id)
    );
    return contracts.filter((c) => {
      const tags = getContractFolderIds(c);
      if (!tags.length) return parentFolderId === null;
      if (parentFolderId === null) return false;
      if (!tags.includes(parentFolderId)) return false;
      return !tags.some((id) => childIds.has(id));
    });
  }

  const ids = descendants.get(last.id) ?? new Set([last.id]);
  return contracts.filter((c) => contractHasFolderInSet(c, ids));
}

export function folderPathLabel(path: FolderPath): string[] {
  return path.map((segment) =>
    segment.kind === "unassigned" ? UNASSIGNED_FOLDER_LABEL : segment.name
  );
}

export function getInvalidMoveTargets(
  folderId: string,
  folders: FolderRecord[]
): Set<string> {
  const descendants = buildDescendantsMap(folders);
  return descendants.get(folderId) ?? new Set([folderId]);
}

export function buildMoveTargetOptions(
  folderId: string,
  folders: FolderRecord[]
): { id: string | null; label: string }[] {
  const invalid = getInvalidMoveTargets(folderId, folders);
  const byParent = new Map<string | null, FolderRecord[]>();

  for (const folder of folders) {
    if (invalid.has(folder.id)) continue;
    const list = byParent.get(folder.parent_id) ?? [];
    list.push(folder);
    byParent.set(folder.parent_id, list);
  }

  const options: { id: string | null; label: string }[] = [
    { id: null, label: "Top level" },
  ];

  function walk(parentId: string | null, prefix: string) {
    const children = (byParent.get(parentId) ?? []).sort(compareFolderSiblings);
    for (const child of children) {
      const label = prefix ? `${prefix} / ${child.name}` : child.name;
      options.push({ id: child.id, label });
      walk(child.id, label);
    }
  }

  walk(null, "");
  return options;
}
