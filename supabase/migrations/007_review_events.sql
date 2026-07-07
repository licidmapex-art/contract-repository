-- Track metadata review actions for dashboard scoring

create table if not exists metadata_review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_email text,
  contract_id uuid references contracts(id) on delete cascade,
  field_id uuid references metadata_fields(id) on delete set null,
  action text not null check (action in ('confirm', 'correct')),
  points integer not null check (points in (1, 5)),
  created_at timestamptz default now()
);

create index if not exists metadata_review_events_user_id_idx
  on metadata_review_events(user_id);

create index if not exists metadata_review_events_created_at_idx
  on metadata_review_events(created_at);

alter table metadata_review_events enable row level security;

drop policy if exists "Authenticated users can read metadata_review_events" on metadata_review_events;
drop policy if exists "Authenticated users can insert metadata_review_events" on metadata_review_events;

create policy "Authenticated users can read metadata_review_events"
  on metadata_review_events for select to authenticated using (true);

create policy "Authenticated users can insert metadata_review_events"
  on metadata_review_events for insert to authenticated with check (true);
