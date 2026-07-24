import { createClient } from "@supabase/supabase-js";
import { assertSupabaseConfigured, getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/types";

export function createSupabaseAdminClient() {
  assertSupabaseConfigured();

  const secretKey = getSupabaseSecretKey();

  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required for privileged server operations.");
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
