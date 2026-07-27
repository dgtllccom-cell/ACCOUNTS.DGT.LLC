import { createClient } from "@supabase/supabase-js";
import { assertSupabaseConfigured, getSupabasePublicKey, getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/types";

export function createSupabaseAdminClient() {
  assertSupabaseConfigured();

  const secretKey = getSupabaseSecretKey() || getSupabasePublicKey();

  if (!secretKey) {
    throw new Error("Supabase URL and API Key are required for database operations.");
  }

  return createClient<Database>(
    getSupabaseUrl()!,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
