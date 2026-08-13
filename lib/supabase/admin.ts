import { createClient } from "@supabase/supabase-js";
import { assertSupabaseConfigured, getSupabasePublicKey, getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/types";

export function createSupabaseAdminClient() {
  assertSupabaseConfigured();

  const secretKey = getSupabaseSecretKey();

  if (!secretKey || /^sb_(publishable|anon)_/i.test(secretKey) || secretKey === getSupabasePublicKey()) {
    throw new Error(
      "A real SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required for privileged server operations. Publishable/anon keys are not accepted."
    );
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
