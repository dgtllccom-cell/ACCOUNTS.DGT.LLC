"use client";

import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseConfigured, getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";

export function createClientSupabaseClient() {
  assertSupabaseConfigured();

  return createBrowserClient(getSupabaseUrl()!, getSupabasePublicKey()!);
}
