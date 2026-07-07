export type DocumentRole =
  | "original"
  | "annex"
  | "amendment"
  | "renewal"
  | "correspondence"
  | "other";

export type ProcessingStatus =
  | "pending"
  | "processing"
  | "complete"
  | "failed";

export type EffectiveStatus =
  | "active"
  | "inactive"
  | "expiring"
  | "upcoming_renewal"
  | "expired";

export type RelationshipType =
  | "renews"
  | "supersedes"
  | "same_counterparty"
  | "related";

export type FieldType = "text" | "date" | "number" | "boolean" | "enum";

export interface LegalEntity {
  id: string;
  name: string;
  registration_number: string | null;
  country: string | null;
  vat_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface Counterparty {
  id: string;
  name: string;
  registration_number: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
}

export interface ContractType {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  created_at: string;
}

export interface Contract {
  id: string;
  contract_number: number | null;
  title: string | null;
  status: "active" | "inactive";
  legal_entity_id: string | null;
  counterparty_id: string | null;
  contract_type_id: string | null;
  folder_id: string | null;
  folder_ids?: string[];
  created_at: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  contract_id: string;
  role: DocumentRole;
  storage_path: string;
  original_filename: string;
  generated_filename: string | null;
  extracted_text: string | null;
  processing_status: ProcessingStatus;
  uploaded_via: string;
  created_at: string;
}

export interface MetadataField {
  id: string;
  key: string;
  label: string;
  category: string;
  field_type: FieldType;
  enum_options: string[] | null;
  playbook_prompt: string;
  is_builtin: boolean;
  created_at: string;
}

export interface MetadataValue {
  id: string;
  contract_id: string;
  field_id: string;
  value: string | null;
  confidence: number | null;
  confirmed: boolean;
  source_document_id: string | null;
  evidence_page: number | null;
  evidence_text: string | null;
  updated_at: string;
  metadata_fields?: MetadataField;
}

export interface ContractRelationship {
  id: string;
  contract_a_id: string;
  contract_b_id: string;
  relationship_type: RelationshipType;
  confirmed: boolean;
  created_at: string;
}

export interface NamingSettings {
  id: string;
  template: string;
  keep_original_name: boolean;
}

export interface ContractWithDetails extends Contract {
  documents: Document[];
  metadata_values: MetadataValue[];
  relationships: ContractRelationship[];
  effective_status: EffectiveStatus;
  pending_review_count: number;
  legal_entity?: LegalEntity | null;
  counterparty?: Counterparty | null;
  contract_type?: ContractType | null;
  folder?: Pick<Folder, "id" | "name" | "parent_id"> | null;
  folder_path?: string | null;
  folder_paths?: string[];
  folders?: Pick<Folder, "id" | "name" | "parent_id">[];
  display_name?: string;
}

export interface FilterClause {
  field: string;
  op: "=" | "!=" | "<" | "<=" | ">" | ">=" | "contains";
  value: string;
}

export interface StructuredFilter {
  filters: FilterClause[];
}

export const DOCUMENT_ROLES: DocumentRole[] = [
  "original",
  "annex",
  "amendment",
  "renewal",
  "correspondence",
  "other",
];

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  "renews",
  "supersedes",
  "same_counterparty",
  "related",
];

export const CONFIDENCE_THRESHOLD = 0.75;

export type BulkMetadataMode = "set" | "add";

export interface BulkMetadataUpdate {
  fieldId: string;
  value: string | null;
  mode?: BulkMetadataMode;
}

export interface BulkFolderUpdate {
  folderId: string;
  mode: "add" | "remove" | "set";
}

export type ApiKeyTestStatus = "ok" | "quota_exceeded" | "invalid" | "error";

export interface PublicApiKey {
  id: string;
  provider: string;
  label: string;
  api_key_masked: string;
  sort_order: number;
  last_test_status: ApiKeyTestStatus | null;
  last_test_message: string | null;
  last_tested_at: string | null;
  created_at: string;
}
