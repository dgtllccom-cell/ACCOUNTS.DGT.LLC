import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/config";

function hasSupabaseSessionCookie(request: NextRequest) {
  // Supabase SSR stores sessions in cookies that may be chunked:
  // - sb-auth-token, sb-auth-token.0, sb-<project>-auth-token, etc.
  // Older projects might still use sb-access-token/sb-refresh-token.
  return request.cookies.getAll().some(({ name }) => {
    if (name === "sb-access-token" || name === "sb-refresh-token") return true;
    if (name === "sb-auth-token" || name.startsWith("sb-auth-token.")) return true;
    if (name.includes("auth-token") && name.startsWith("sb-")) return true;
    if (name.startsWith("supabase-auth-token")) return true;
    return false;
  });
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof supabaseResponse.cookies.set>[2];
  };

  try {
    if (!isSupabaseConfigured()) {
      return supabaseResponse;
    }

    // Auth pages must stay available even when Supabase/Auth is slow or unreachable.
    if (request.nextUrl.pathname.startsWith("/auth")) {
      return supabaseResponse;
    }

    // Avoid calling Supabase Auth on every request when there is no Supabase session cookie.
    if (!hasSupabaseSessionCookie(request)) {
      return supabaseResponse;
    }

    const supabase = createServerClient(
      getSupabaseUrl()!,
      getSupabasePublicKey()!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          }
        }
      }
    );

    await supabase.auth.getUser();
  } catch (err) {
    console.error("Middleware Session Error:", err);
    return supabaseResponse;
  }
  return supabaseResponse;
}
