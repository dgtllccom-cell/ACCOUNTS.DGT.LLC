import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { assertSupabaseConfigured, getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";

export async function createServerSupabaseClient() {
  assertSupabaseConfigured();

  const cookieStore = await cookies();
  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof cookieStore.set>[2];
  };

  return createServerClient(
    getSupabaseUrl()!,
    getSupabasePublicKey()!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server components cannot set cookies; middleware refreshes sessions.
          }
        }
      }
    }
  );
}
