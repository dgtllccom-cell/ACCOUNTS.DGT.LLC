import { ensureEnvironmentVerifiedOnce } from "@/lib/env/environment";

export function getSupabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
}

export function getSupabasePublicKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return key.trim();
}

export function getSupabaseSecretKey(): string {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (secret && secret.trim() !== "") {
    return secret.trim();
  }
  return "";
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublicKey());
}

export function isDemoAuthEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEMO_AUTH === "true";
}

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase environment variables are not configured. Please define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment or .env.local.");
  }
  // Enforce dev/prod database separation at every Supabase client creation.
  ensureEnvironmentVerifiedOnce();
}

