-- Many-to-many contract ↔ folder tags (contracts can belong to multiple folders)

create table if not exists contract_folders (
  contract_id uuid not null references contracts(id) on delete cascade,
  folder_id uuid not null references folders(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (contract_id, folder_id)
);

create index if not exists contract_folders_folder_id_idx
  on contract_folders (folder_id);

-- Migrate existing single folder_id assignments
insert into contract_folders (contract_id, folder_id)
select id, folder_id
from contracts
where folder_id is not null
on conflict (contract_id, folder_id) do nothing;

alter table contract_folders enable row level security;

drop policy if exists "Authenticated users can read contract_folders" on contract_folders;
drop policy if exists "Authenticated users can insert contract_folders" on contract_folders;
drop policy if exists "Authenticated users can delete contract_folders" on contract_folders;

create policy "Authenticated users can read contract_folders"
  on contract_folders for select to authenticated using (true);
create policy "Authenticated users can insert contract_folders"
  on contract_folders for insert to authenticated with check (true);
create policy "Authenticated users can delete contract_folders"
  on contract_folders for delete to authenticated using (true);
