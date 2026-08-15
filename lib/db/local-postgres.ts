import fs from "fs";
import path from "path";
import postgres from "postgres";

/**
 * Shared direct-Postgres connection helper (DATABASE_URL). This bypasses PostgREST/RLS
 * entirely — the connection authenticates as the Postgres role embedded in DATABASE_URL,
 * not the anon/authenticated PostgREST roles that RLS policies gate. Used as the proven,
 * working root-cause bypass for reads/writes on tables where the app's "admin" Supabase
 * client (lib/supabase/admin.ts) cannot be relied on to carry a true service-role key.
 *
 * Originally duplicated ad hoc in lib/repositories/companies-repository.ts and
 * lib/i18n/localize-records.ts; centralized here so every repository can reuse the same
 * lookup logic instead of copy-pasting it (and so there's exactly one place to update if
 * the env var name / precedence ever changes).
 */
export function getDbUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    for (const file of [".env.local", ".env"]) {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf8");
        const match = content.match(/^DATABASE_URL\s*=\s*(.+)$/m);
        if (match) return match[1].trim().replace(/^['"]|['"]$/g, "");
      }
    }
  } catch {
    // ignore — falls through to "" below, callers treat that as "not configured"
  }
  return "";
}

/**
 * Runs `fn` with a short-lived direct-Postgres connection when DATABASE_URL is configured,
 * always closing the connection afterward. Returns null if DATABASE_URL isn't set, so
 * callers can fall back to the Supabase client path.
 */
export async function withLocalPg<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T | null> {
  const url = getDbUrl();
  if (!url) return null;
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
