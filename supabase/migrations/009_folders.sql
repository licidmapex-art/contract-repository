-- Free-form folders (independent of contract type / counterparty / legal entity)

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references folders(id) on delete cascade,
  created_at timestamptz default now()
);

create unique index if not exists folders_unique_name_per_parent_idx
  on folders (parent_id, lower(name));

alter table contracts
  add column if not exists folder_id uuid references folders(id) on delete set null;

alter table folders enable row level security;

drop policy if exists "Authenticated users can read folders" on folders;
drop policy if exists "Authenticated users can insert folders" on folders;
drop policy if exists "Authenticated users can update folders" on folders;
drop policy if exists "Authenticated users can delete folders" on folders;

create policy "Authenticated users can read folders"
  on folders for select to authenticated using (true);
create policy "Authenticated users can insert folders"
  on folders for insert to authenticated with check (true);
create policy "Authenticated users can update folders"
  on folders for update to authenticated using (true);
create policy "Authenticated users can delete folders"
  on folders for delete to authenticated using (true);

-- Optional metadata field for folder path display / search
insert into metadata_fields (key, label, category, field_type, playbook_prompt, is_builtin)
values (
  'activity_folder',
  'Folder',
  'Classification',
  'text',
  'Select the best matching folder path from the known folder list provided during extraction (e.g. Natural gas / EU). Return ONLY an exact path from that list, or null if none fit.',
  true
)
on conflict (key) do nothing;
