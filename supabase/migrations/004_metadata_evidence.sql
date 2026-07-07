alter table metadata_values
  add column if not exists evidence_page integer null,
  add column if not exists evidence_text text null;
