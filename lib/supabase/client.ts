"use client";

import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseConfigured, getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";
import { isPrototypeMode } from "@/lib/prototype/mode";
import { createPrototypeSupabaseClient } from "@/lib/prototype/mock-supabase";

export function createClientSupabaseClient() {
  if (isPrototypeMode()) return createPrototypeSupabaseClient();
  assertSupabaseConfigured();

  return createBrowserClient(getSupabaseUrl()!, getSupabasePublicKey()!);
}
