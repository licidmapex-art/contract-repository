-- Legal entities (our own companies) and counterparties (external parties)

create table if not exists legal_entities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration_number text,
  country text,
  vat_number text,
  notes text,
  created_at timestamptz default now(),
  unique (name)
);

create table if not exists counterparties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration_number text,
  country text,
  notes text,
  created_at timestamptz default now(),
  unique (name)
);

alter table contracts
  add column if not exists legal_entity_id uuid references legal_entities(id) on delete set null;

alter table contracts
  add column if not exists counterparty_id uuid references counterparties(id) on delete set null;

alter table legal_entities enable row level security;
alter table counterparties enable row level security;

drop policy if exists "Authenticated users can read legal_entities" on legal_entities;
drop policy if exists "Authenticated users can insert legal_entities" on legal_entities;
drop policy if exists "Authenticated users can update legal_entities" on legal_entities;
drop policy if exists "Authenticated users can delete legal_entities" on legal_entities;
drop policy if exists "Authenticated users can read counterparties" on counterparties;
drop policy if exists "Authenticated users can insert counterparties" on counterparties;
drop policy if exists "Authenticated users can update counterparties" on counterparties;
drop policy if exists "Authenticated users can delete counterparties" on counterparties;

create policy "Authenticated users can read legal_entities" on legal_entities for select to authenticated using (true);
create policy "Authenticated users can insert legal_entities" on legal_entities for insert to authenticated with check (true);
create policy "Authenticated users can update legal_entities" on legal_entities for update to authenticated using (true);
create policy "Authenticated users can delete legal_entities" on legal_entities for delete to authenticated using (true);

create policy "Authenticated users can read counterparties" on counterparties for select to authenticated using (true);
create policy "Authenticated users can insert counterparties" on counterparties for insert to authenticated with check (true);
create policy "Authenticated users can update counterparties" on counterparties for update to authenticated using (true);
create policy "Authenticated users can delete counterparties" on counterparties for delete to authenticated using (true);
