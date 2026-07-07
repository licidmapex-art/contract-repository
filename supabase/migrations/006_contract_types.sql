-- Managed contract types (selected from list during extraction and on contracts)

create table if not exists contract_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  notes text,
  created_at timestamptz default now(),
  unique (name)
);

alter table contracts
  add column if not exists contract_type_id uuid references contract_types(id) on delete set null;

alter table contract_types enable row level security;

drop policy if exists "Authenticated users can read contract_types" on contract_types;
drop policy if exists "Authenticated users can insert contract_types" on contract_types;
drop policy if exists "Authenticated users can update contract_types" on contract_types;
drop policy if exists "Authenticated users can delete contract_types" on contract_types;

create policy "Authenticated users can read contract_types" on contract_types for select to authenticated using (true);
create policy "Authenticated users can insert contract_types" on contract_types for insert to authenticated with check (true);
create policy "Authenticated users can update contract_types" on contract_types for update to authenticated using (true);
create policy "Authenticated users can delete contract_types" on contract_types for delete to authenticated using (true);

update metadata_fields
set playbook_prompt = 'Identify the contract type. Return ONLY an exact name from the known contract types list provided during extraction. If none match, return null.'
where key = 'contract_type';
