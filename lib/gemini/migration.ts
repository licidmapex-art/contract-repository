export const API_KEYS_MIGRATION_SQL = `-- Gemini API keys (managed in Settings; env vars remain as fallback)

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
`;

export function isMissingSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /could not find the table|schema cache|relation .* does not exist|PGRST205/i.test(
    message
  );
}

export function getSupabaseSqlEditorUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const match = url?.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) return null;
  return `https://supabase.com/dashboard/project/${match[1]}/sql/new`;
}
