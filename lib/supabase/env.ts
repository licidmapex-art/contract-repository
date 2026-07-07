const SUPABASE_ENV_MESSAGE =
  "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
  "(and SUPABASE_SERVICE_ROLE_KEY) in .env.local or your host environment variables. " +
  "On Netlify: set scopes to All, then Clear cache and deploy site. " +
  "Find values at https://supabase.com/dashboard/project/_/settings/api";

function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** Public Supabase URL — prefers runtime vars on Netlify middleware/edge. */
export function getSupabaseUrl(): string | undefined {
  return readEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
}

/** Public anon key — prefers runtime vars on Netlify middleware/edge. */
export function getSupabaseAnonKey(): string | undefined {
  return readEnv("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getSupabasePublicEnv(): { url: string; anonKey: string } {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error(SUPABASE_ENV_MESSAGE);
  }

  return { url, anonKey };
}

export function hasSupabasePublicEnv(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Add it to .env.local or your deployment environment."
    );
  }
  return key;
}

export function getSupabaseEnvStatus() {
  return {
    hasUrl: Boolean(getSupabaseUrl()),
    hasAnonKey: Boolean(getSupabaseAnonKey()),
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    hasNextPublicUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    hasNextPublicAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
    hasRuntimeUrl: Boolean(process.env.SUPABASE_URL?.trim()),
    hasRuntimeAnonKey: Boolean(process.env.SUPABASE_ANON_KEY?.trim()),
  };
}

export { SUPABASE_ENV_MESSAGE };
