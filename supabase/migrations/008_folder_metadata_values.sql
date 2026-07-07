-- User-managed folder tree (scoped subfolders mapped to metadata field keys)

create table if not exists folder_metadata_values (
  id uuid primary key default gen_random_uuid(),
  field_key text not null,
  value text not null,
  parent_path jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create unique index if not exists folder_metadata_values_unique_idx
  on folder_metadata_values (field_key, lower(value), parent_path);

alter table folder_metadata_values enable row level security;

drop policy if exists "Authenticated users can read folder_metadata_values" on folder_metadata_values;
drop policy if exists "Authenticated users can insert folder_metadata_values" on folder_metadata_values;
drop policy if exists "Authenticated users can delete folder_metadata_values" on folder_metadata_values;

create policy "Authenticated users can read folder_metadata_values"
  on folder_metadata_values for select to authenticated using (true);
create policy "Authenticated users can insert folder_metadata_values"
  on folder_metadata_values for insert to authenticated with check (true);
create policy "Authenticated users can delete folder_metadata_values"
  on folder_metadata_values for delete to authenticated using (true);
