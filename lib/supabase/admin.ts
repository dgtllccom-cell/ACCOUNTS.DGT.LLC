import { createClient } from "@supabase/supabase-js";
import { assertSupabaseConfigured, getSupabasePublicKey, getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/types";

export function createSupabaseAdminClient() {
  assertSupabaseConfigured();

  const secretKey = getSupabaseSecretKey();
  const effectiveKey =
    secretKey && !/^sb_(publishable|anon)_/i.test(secretKey) && secretKey !== getSupabasePublicKey()
      ? secretKey
      : getSupabasePublicKey();

  return createClient<Database>(
    getSupabaseUrl()!,
    effectiveKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
