import { createClient } from "@supabase/supabase-js";
import { assertSupabaseConfigured, getSupabasePublicKey, getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/types";

export function createSupabaseServiceClient() {
  assertSupabaseConfigured();

  const secretKey = getSupabaseSecretKey();
  if (!secretKey || /^sb_(publishable|anon)_/i.test(secretKey) || secretKey === getSupabasePublicKey()) {
    throw new Error(
      "Supabase service role key is missing or invalid. Set SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) to the real DEV service role key before using secure document storage."
    );
  }

  return createClient<Database>(getSupabaseUrl()!, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}
