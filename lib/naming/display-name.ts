import { applyNamingTemplate } from "@/lib/naming/apply-template";
import { DocumentRole, MetadataValue } from "@/lib/types";

export function metadataRecordFromContract(
  metadataValues: MetadataValue[],
  parties?: {
    legalEntity?: string | null;
    counterparty?: string | null;
    contractType?: string | null;
  }
): Record<string, string | null> {
  const metadata: Record<string, string | null> = {};

  for (const row of metadataValues) {
    const key = row.metadata_fields?.key;
    if (key) metadata[key] = row.value;
  }

  if (parties?.legalEntity) metadata.legal_entity = parties.legalEntity;
  if (parties?.counterparty) metadata.counterparty = parties.counterparty;
  if (parties?.contractType) metadata.contract_type = parties.contractType;

  return metadata;
}

export function contractDisplayName(
  template: string,
  metadataValues: MetadataValue[],
  documentRole: DocumentRole = "original",
  parties?: {
    legalEntity?: string | null;
    counterparty?: string | null;
    contractType?: string | null;
  }
): string {
  const metadata = metadataRecordFromContract(metadataValues, parties);
  const name = applyNamingTemplate(template, metadata, documentRole);
  return name === "Unknown" ? "Untitled" : name;
}
