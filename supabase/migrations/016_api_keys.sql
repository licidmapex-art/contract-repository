-- Gemini API keys (managed in Settings; env vars remain as fallback)

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'gemini' check (provider = 'gemini'),
  label text not null default '',
  api_key text not null,
  sort_order integer not null default 0,
  last_test_status text check (
    last_test_status in ('ok', 'quota_exceeded', 'invalid', 'error')
  ),
  last_test_message text,
  last_tested_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists api_keys_provider_sort_idx on api_keys (provider, sort_order);

create table if not exists app_settings (
  key text primary key,
  value text not null
);

insert into app_settings (key, value)
values ('gemini_model', 'gemini-2.5-flash')
on conflict (key) do nothing;

alter table api_keys enable row level security;
alter table app_settings enable row level security;

-- Keys are only accessed server-side via the service role (no client policies).
