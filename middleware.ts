import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  getSupabasePublicEnv,
  hasSupabasePublicEnv,
  SUPABASE_ENV_MESSAGE,
} from "@/lib/supabase/env";

export async function middleware(request: NextRequest) {
  const isSetupStatus = request.nextUrl.pathname === "/api/setup/status";
  if (isSetupStatus) {
    return NextResponse.next({ request });
  }

  if (!hasSupabasePublicEnv()) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: SUPABASE_ENV_MESSAGE }, { status: 503 });
    }

    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Configuration required</title></head><body style="font-family:system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5"><h1>Supabase not configured</h1><p>${SUPABASE_ENV_MESSAGE}</p><p><a href="https://supabase.com/dashboard/project/_/settings/api">Open Supabase API settings</a></p></body></html>`,
      {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  const { url, anonKey } = getSupabasePublicEnv();
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = request.nextUrl.pathname.startsWith("/login");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");

  if (!user && !isAuthPage && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
