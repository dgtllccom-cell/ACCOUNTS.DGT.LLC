export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || "https://csesvyxxjivnkkozgopt.supabase.co";
}

export function getSupabasePublicKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_22nhsWCggOvyEf-hYmAcfA_vFo7zk4w";
}

export function getSupabaseSecretKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "sb_publishable_22nhsWCggOvyEf-hYmAcfA_vFo7zk4w";
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabasePublicKey());
}

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase environment variables are not configured.");
  }
}
