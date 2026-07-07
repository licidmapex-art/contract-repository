import { nameSimilarity } from "@/lib/entities/match";
import { FolderRecord } from "@/lib/folders/navigation";
import { ExtractedField } from "@/lib/gemini/extract";

export const FOLDER_CONFIDENCE_THRESHOLD = 0.9;

export interface FolderPathOption {
  id: string;
  path: string;
}

export function buildFolderPathLabel(
  folderId: string,
  folders: FolderRecord[]
): string | null {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const parts: string[] = [];
  let current = byId.get(folderId) ?? null;

  while (current) {
    parts.unshift(current.name);
    current = current.parent_id ? byId.get(current.parent_id) ?? null : null;
  }

  return parts.length ? parts.join(" / ") : null;
}

export function buildFolderPathOptions(
  folders: FolderRecord[]
): FolderPathOption[] {
  return folders
    .map((folder) => ({
      id: folder.id,
      path: buildFolderPathLabel(folder.id, folders) ?? folder.name,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function findBestFolderPathMatch(
  text: string | null | undefined,
  options: FolderPathOption[]
): FolderPathOption | null {
  if (!text?.trim() || !options.length) return null;

  let best: { option: FolderPathOption; score: number } | null = null;

  for (const option of options) {
    const pathScore = nameSimilarity(text, option.path);
    const leaf = option.path.split(" / ").pop() ?? option.path;
    const leafScore = nameSimilarity(text, leaf);
    const score = Math.max(pathScore, leafScore);

    if (score >= 0.82 && (!best || score > best.score)) {
      best = { option, score };
    }
  }

  return best?.option ?? null;
}

export function normalizeFolderExtraction(
  extracted: ExtractedField[],
  folders: FolderRecord[]
): ExtractedField[] {
  if (!folders.length) return extracted;

  const options = buildFolderPathOptions(folders);

  return extracted.map((item) => {
    if (item.key !== "activity_folder" || !item.value?.trim()) return item;

    const match = findBestFolderPathMatch(item.value, options);
    if (!match) {
      return { ...item, value: null, confidence: 0 };
    }

    return { ...item, value: match.path };
  });
}

export function resolveFolderIdFromPath(
  path: string | null | undefined,
  folders: FolderRecord[]
): string | null {
  if (!path?.trim() || !folders.length) return null;
  const options = buildFolderPathOptions(folders);
  return findBestFolderPathMatch(path, options)?.id ?? null;
}

export function folderExtractionConfirmed(confidence: number | null | undefined) {
  return (confidence ?? 0) >= FOLDER_CONFIDENCE_THRESHOLD;
}
