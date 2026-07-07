import { createAdminClient } from "@/lib/supabase/admin";
import { computeEffectiveStatusFromMetadata } from "@/lib/contracts/status";
import { contractDisplayName } from "@/lib/naming/display-name";
import { fetchAllFolders } from "@/lib/folders/db";
import {
  buildFolderPaths,
  fetchContractFolderIds,
  fetchFolderIdsByContractIds,
} from "@/lib/folders/contract-folders";
import { buildFolderPathLabel } from "@/lib/folders/match";
import { FolderRecord } from "@/lib/folders/navigation";
import {
  ContractRelationship,
  ContractWithDetails,
  Document,
  DocumentRole,
  Folder,
  MetadataValue,
} from "@/lib/types";

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

const CONTRACT_SELECT_MINIMAL =
  "*, legal_entity:legal_entities!legal_entity_id(*), counterparty:counterparties!counterparty_id(*)";

type ContractRow = Record<string, unknown> & {
  id: string;
  status: ContractWithDetails["status"];
  legal_entity: ContractWithDetails["legal_entity"];
  counterparty: ContractWithDetails["counterparty"];
  contract_type?: ContractWithDetails["contract_type"] | null;
  folder?: Pick<Folder, "id" | "name" | "parent_id"> | null;
  folder_id?: string | null;
};

function groupRowsByContractId<T extends { contract_id: string }>(
  rows: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.contract_id) ?? [];
    list.push(row);
    map.set(row.contract_id, list);
  }
  return map;
}

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
    .select(CONTRACT_SELECT_MINIMAL)
    .eq("id", contractId)
    .single();

  if (withoutRelations.error || !withoutRelations.data) return null;

  return {
    ...(withoutRelations.data as ContractRow),
    contract_type: null,
    folder: null,
  };
}

async function fetchAllContractRows(
  supabase: ReturnType<typeof createAdminClient>
): Promise<ContractRow[]> {
  const withType = await supabase
    .from("contracts")
    .select(CONTRACT_SELECT_WITH_TYPE)
    .order("created_at", { ascending: false });

  if (!withType.error && withType.data?.length) {
    return withType.data as ContractRow[];
  }

  const withFolderOnly = await supabase
    .from("contracts")
    .select(CONTRACT_SELECT_BASE)
    .order("created_at", { ascending: false });

  if (!withFolderOnly.error && withFolderOnly.data?.length) {
    return withFolderOnly.data.map((row) => ({
      ...(row as ContractRow),
      contract_type: null,
    }));
  }

  const withoutRelations = await supabase
    .from("contracts")
    .select(CONTRACT_SELECT_MINIMAL)
    .order("created_at", { ascending: false });

  if (withoutRelations.error || !withoutRelations.data?.length) {
    return [];
  }

  return withoutRelations.data.map((row) => ({
    ...(row as ContractRow),
    contract_type: null,
    folder: null,
  }));
}

async function fetchRelationshipsByContractIds(
  contractIds: string[]
): Promise<Map<string, ContractRelationship[]>> {
  const map = new Map<string, ContractRelationship[]>();
  for (const contractId of contractIds) {
    map.set(contractId, []);
  }

  if (!contractIds.length) return map;

  const supabase = createAdminClient();
  const [relsA, relsB] = await Promise.all([
    supabase
      .from("contract_relationships")
      .select("*")
      .in("contract_a_id", contractIds),
    supabase
      .from("contract_relationships")
      .select("*")
      .in("contract_b_id", contractIds),
  ]);

  const seen = new Set<string>();
  for (const row of [...(relsA.data ?? []), ...(relsB.data ?? [])]) {
    const relationship = row as ContractRelationship;
    if (seen.has(relationship.id)) continue;
    seen.add(relationship.id);

    map.get(relationship.contract_a_id)?.push(relationship);
    if (relationship.contract_b_id !== relationship.contract_a_id) {
      map.get(relationship.contract_b_id)?.push(relationship);
    }
  }

  return map;
}

function resolveFolderDetails(
  folderIds: string[],
  allFolders: FolderRecord[]
) {
  const folder_paths = buildFolderPaths(folderIds, allFolders);
  const byId = new Map(allFolders.map((folder) => [folder.id, folder]));
  const folders = folderIds
    .map((id) => byId.get(id))
    .filter((folder): folder is FolderRecord => Boolean(folder))
    .map((folder) => ({
      id: folder.id,
      name: folder.name,
      parent_id: folder.parent_id,
    }));

  const primaryFolderId = folderIds[0] ?? null;
  const folder_path =
    folder_paths.length > 0
      ? folder_paths.join("; ")
      : primaryFolderId
        ? buildFolderPathLabel(primaryFolderId, allFolders)
        : null;

  return { folderIds, folders, folder_paths, folder_path, primaryFolderId };
}

function assembleContractWithDetails(
  contract: ContractRow,
  {
    documents,
    metadata_values,
    relationships,
    folderIds,
    allFolders,
    namingTemplate,
  }: {
    documents: Document[];
    metadata_values: MetadataValue[];
    relationships: ContractRelationship[];
    folderIds: string[];
    allFolders: FolderRecord[];
    namingTemplate: string;
  }
): ContractWithDetails {
  const pending_review_count = metadata_values.filter((value) => !value.confirmed)
    .length;

  const legalEntityName = contract.legal_entity?.name ?? null;
  const counterpartyName = contract.counterparty?.name ?? null;
  const contractTypeName = contract.contract_type?.name ?? null;
  const primaryRole = (documents[0]?.role as DocumentRole) ?? "original";

  const display_name = contractDisplayName(
    namingTemplate,
    metadata_values,
    primaryRole,
    {
      legalEntity: legalEntityName,
      counterparty: counterpartyName,
      contractType: contractTypeName,
    }
  );

  const folderDetails = resolveFolderDetails(folderIds, allFolders);

  return {
    ...(contract as unknown as Omit<
      ContractWithDetails,
      | "documents"
      | "metadata_values"
      | "relationships"
      | "effective_status"
      | "pending_review_count"
      | "display_name"
      | "folder_path"
      | "folder_paths"
      | "folder_ids"
      | "folders"
      | "legal_entity"
      | "counterparty"
      | "contract_type"
      | "folder"
      | "folder_id"
    >),
    legal_entity: contract.legal_entity ?? null,
    counterparty: contract.counterparty ?? null,
    contract_type: contract.contract_type ?? null,
    folder:
      folderDetails.folders[0] ?? contract.folder ?? null,
    folder_id:
      folderDetails.primaryFolderId ?? (contract.folder_id as string | null) ?? null,
    folder_ids: folderDetails.folderIds,
    folders: folderDetails.folders,
    folder_path: folderDetails.folder_path,
    folder_paths: folderDetails.folder_paths,
    documents,
    metadata_values,
    relationships,
    effective_status: computeEffectiveStatusFromMetadata(
      contract.status,
      metadata_values
    ),
    pending_review_count,
    display_name,
  };
}

export async function fetchContractWithDetails(
  contractId: string,
  namingTemplate?: string
): Promise<ContractWithDetails | null> {
  const supabase = createAdminClient();
  const contract = await fetchContractRow(supabase, contractId);
  if (!contract) return null;

  const [documentsResult, metadataResult, relationshipsResult, folderIds, template, allFolders] =
    await Promise.all([
      supabase
        .from("documents")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at"),
      supabase
        .from("metadata_values")
        .select("*, metadata_fields(*)")
        .eq("contract_id", contractId),
      supabase
        .from("contract_relationships")
        .select("*")
        .or(`contract_a_id.eq.${contractId},contract_b_id.eq.${contractId}`),
      fetchContractFolderIds(contractId),
      namingTemplate ? Promise.resolve(namingTemplate) : getNamingTemplate(),
      fetchAllFolders(),
    ]);

  return assembleContractWithDetails(contract, {
    documents: (documentsResult.data ?? []) as Document[],
    metadata_values: (metadataResult.data ?? []) as MetadataValue[],
    relationships: (relationshipsResult.data ?? []) as ContractRelationship[],
    folderIds,
    allFolders,
    namingTemplate: template,
  });
}

export async function fetchAllContractsWithDetails(): Promise<
  ContractWithDetails[]
> {
  const supabase = createAdminClient();
  const contractRows = await fetchAllContractRows(supabase);
  if (!contractRows.length) return [];

  const contractIds = contractRows.map((contract) => contract.id);

  const [
    namingTemplate,
    allFolders,
    folderIdsByContract,
    documentsResult,
    metadataResult,
    relationshipsByContract,
  ] = await Promise.all([
    getNamingTemplate(),
    fetchAllFolders(),
    fetchFolderIdsByContractIds(contractIds),
    supabase
      .from("documents")
      .select("*")
      .in("contract_id", contractIds)
      .order("created_at"),
    supabase
      .from("metadata_values")
      .select("*, metadata_fields(*)")
      .in("contract_id", contractIds),
    fetchRelationshipsByContractIds(contractIds),
  ]);

  const documentsByContract = groupRowsByContractId(
    (documentsResult.data ?? []) as Document[]
  );
  const metadataByContract = groupRowsByContractId(
    (metadataResult.data ?? []) as MetadataValue[]
  );

  return contractRows.map((contract) =>
    assembleContractWithDetails(contract, {
      documents: documentsByContract.get(contract.id) ?? [],
      metadata_values: metadataByContract.get(contract.id) ?? [],
      relationships: relationshipsByContract.get(contract.id) ?? [],
      folderIds: folderIdsByContract.get(contract.id) ?? [],
      allFolders,
      namingTemplate,
    })
  );
}
