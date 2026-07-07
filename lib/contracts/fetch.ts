import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeEffectiveStatusFromMetadata,
  getMetadataValue,
} from "@/lib/contracts/status";
import { contractDisplayName } from "@/lib/naming/display-name";
import { fetchAllFolders } from "@/lib/folders/db";
import {
  buildFolderPaths,
  fetchContractFolderIds,
} from "@/lib/folders/contract-folders";
import { buildFolderPathLabel } from "@/lib/folders/match";
import { FolderRecord } from "@/lib/folders/navigation";
import { ContractWithDetails, DocumentRole, Folder, MetadataValue } from "@/lib/types";

const DEFAULT_TEMPLATE =
  "{contract_type}_{counterparty}_{effective_date}_{document_role}";

async function getNamingTemplate(): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("naming_settings")
    .select("template")
    .limit(1)
    .single();

  return data?.template ?? DEFAULT_TEMPLATE;
}

const CONTRACT_SELECT_WITH_TYPE =
  "*, legal_entity:legal_entities!legal_entity_id(*), counterparty:counterparties!counterparty_id(*), contract_type:contract_types!contract_type_id(*), folder:folders!folder_id(id, name, parent_id)";

const CONTRACT_SELECT_BASE =
  "*, legal_entity:legal_entities!legal_entity_id(*), counterparty:counterparties!counterparty_id(*), folder:folders!folder_id(id, name, parent_id)";

type ContractRow = Record<string, unknown> & {
  legal_entity: { name: string } | null;
  counterparty: { name: string } | null;
  contract_type?: { name: string } | null;
  folder?: { id: string; name: string; parent_id: string | null } | null;
  folder_id?: string | null;
};

async function fetchContractRow(
  supabase: ReturnType<typeof createAdminClient>,
  contractId: string
): Promise<ContractRow | null> {
  const withType = await supabase
    .from("contracts")
    .select(CONTRACT_SELECT_WITH_TYPE)
    .eq("id", contractId)
    .single();

  if (!withType.error && withType.data) {
    return withType.data as ContractRow;
  }

  const withFolderOnly = await supabase
    .from("contracts")
    .select(CONTRACT_SELECT_BASE)
    .eq("id", contractId)
    .single();

  if (!withFolderOnly.error && withFolderOnly.data) {
    return {
      ...(withFolderOnly.data as ContractRow),
      contract_type: null,
    };
  }

  const withoutRelations = await supabase
    .from("contracts")
    .select(
      "*, legal_entity:legal_entities!legal_entity_id(*), counterparty:counterparties!counterparty_id(*)"
    )
    .eq("id", contractId)
    .single();

  if (withoutRelations.error || !withoutRelations.data) return null;

  return {
    ...(withoutRelations.data as ContractRow),
    contract_type: null,
    folder: null,
  };
}

async function fetchFolderPath(folderId: string | null | undefined) {
  if (!folderId) return null;
  try {
    const folders = await fetchAllFolders();
    return buildFolderPathLabel(folderId, folders);
  } catch {
    return null;
  }
}

export async function fetchContractWithDetails(
  contractId: string,
  namingTemplate?: string
): Promise<ContractWithDetails | null> {
  const supabase = createAdminClient();

  const contract = await fetchContractRow(supabase, contractId);

  if (!contract) return null;

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at");

  const { data: metadata_values } = await supabase
    .from("metadata_values")
    .select("*, metadata_fields(*)")
    .eq("contract_id", contractId);

  const { data: relationships } = await supabase
    .from("contract_relationships")
    .select("*")
    .or(`contract_a_id.eq.${contractId},contract_b_id.eq.${contractId}`);

  const pending_review_count = (metadata_values ?? []).filter(
    (v) => !v.confirmed
  ).length;

  const template = namingTemplate ?? (await getNamingTemplate());
  const legalEntityName =
    (contract.legal_entity as { name: string } | null)?.name ?? null;
  const counterpartyName =
    (contract.counterparty as { name: string } | null)?.name ?? null;
  const contractTypeName =
    (contract.contract_type as { name: string } | null)?.name ?? null;
  const primaryRole = (documents?.[0]?.role as DocumentRole) ?? "original";

  const display_name = contractDisplayName(
    template,
    (metadata_values ?? []) as MetadataValue[],
    primaryRole,
    {
      legalEntity: legalEntityName,
      counterparty: counterpartyName,
      contractType: contractTypeName,
    }
  );

  const folderIds = await fetchContractFolderIds(contractId);
  let folder_paths: string[] = [];
  let folders: Pick<Folder, "id" | "name" | "parent_id">[] = [];

  try {
    const allFolders = await fetchAllFolders();
    folder_paths = buildFolderPaths(folderIds, allFolders);
    const byId = new Map(allFolders.map((f) => [f.id, f]));
    folders = folderIds
      .map((id) => byId.get(id))
      .filter((f): f is FolderRecord => Boolean(f))
      .map((f) => ({ id: f.id, name: f.name, parent_id: f.parent_id }));
  } catch {
    folder_paths = [];
    folders = [];
  }

  const primaryFolderId = folderIds[0] ?? null;
  const folder_path =
    folder_paths.length > 0
      ? folder_paths.join("; ")
      : await fetchFolderPath(primaryFolderId);

  return {
    ...(contract as Omit<ContractWithDetails, "documents" | "metadata_values" | "relationships" | "effective_status" | "pending_review_count" | "display_name" | "folder_path" | "folder_paths" | "folder_ids" | "folders">),
    legal_entity: (contract.legal_entity ?? null) as ContractWithDetails["legal_entity"],
    counterparty: (contract.counterparty ?? null) as ContractWithDetails["counterparty"],
    contract_type: (contract.contract_type ?? null) as ContractWithDetails["contract_type"],
    folder: folders[0] ?? (contract.folder ?? null) as ContractWithDetails["folder"],
    folder_id: primaryFolderId ?? (contract.folder_id as string | null) ?? null,
    folder_ids: folderIds,
    folders,
    folder_path,
    folder_paths,
    documents: documents ?? [],
    metadata_values: (metadata_values ?? []) as MetadataValue[],
    relationships: relationships ?? [],
    effective_status: computeEffectiveStatusFromMetadata(
      contract.status as ContractWithDetails["status"],
      (metadata_values ?? []) as MetadataValue[]
    ),
    pending_review_count,
    display_name,
  };
}

export async function fetchAllContractsWithDetails(): Promise<
  ContractWithDetails[]
> {
  const supabase = createAdminClient();

  const { data: contracts } = await supabase
    .from("contracts")
    .select("*")
    .order("created_at", { ascending: false });

  if (!contracts?.length) return [];

  const namingTemplate = await getNamingTemplate();
  const results: ContractWithDetails[] = [];
  for (const contract of contracts) {
    const details = await fetchContractWithDetails(contract.id, namingTemplate);
    if (details) results.push(details);
  }
  return results;
}
