export function SupabaseNotConfigured() {
  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-foreground">
        Supabase not configured
      </h1>
      <p className="mt-3 text-sm text-muted">
        Set <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
        <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and{" "}
        <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> in your host
        environment. On Netlify, also add{" "}
        <code className="text-xs">SUPABASE_URL</code> and{" "}
        <code className="text-xs">SUPABASE_ANON_KEY</code>, set scopes to All,
        then clear cache and redeploy.
      </p>
      <p className="mt-4 text-sm">
        <a
          href="https://supabase.com/dashboard/project/_/settings/api"
          className="text-primary hover:underline"
        >
          Open Supabase API settings
        </a>
      </p>
    </div>
  );
}
