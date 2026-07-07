import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabasePublicEnv()) {
    return children;
  }

  try {
    const user = await getAuthenticatedUser();
    if (user) {
      redirect("/");
    }
  } catch {
    // Allow login when Supabase is unreachable.
  }

  return children;
}
