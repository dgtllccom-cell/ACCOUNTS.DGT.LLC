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
    const cwd = path.resolve(process.cwd());
    const roots = [cwd, path.join(cwd, "ACCOUNTS.DGT.LLC"), path.resolve(cwd, "..")];
    for (const root of roots) {
      for (const file of [".env.local", ".env"]) {
        const filePath = path.join(root, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf8");
          const match = content.match(/^DATABASE_URL\s*=\s*(.+)$/m);
          if (match) return match[1].trim().replace(/^['"]|['"]$/g, "");
        }
      }
    }
  } catch {
    // ignore — falls through to "" below, callers treat that as "not configured"
  }
  return "";
}

/**
 * Process-lifetime shared direct-Postgres pool (DATABASE_URL). Unlike {@link withLocalPg},
 * this is created once and never closed, so callers pay the pooler connect cost (~2 s
 * against a remote Supabase pooler) at most once instead of on every call. Use ONLY for
 * fast read-only lookups that run many times per request (e.g. the i18n record localizer,
 * which previously opened/closed a fresh connection per field — ~12 s for a 6-field route).
 * Anything transactional or write-heavy should keep using {@link withLocalPg}.
 */
let _sharedPg: ReturnType<typeof postgres> | null = null;
export function getSharedPg(): ReturnType<typeof postgres> | null {
  const url = getDbUrl();
  if (!url) return null;
  if (_sharedPg) return _sharedPg;
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(url);
  _sharedPg = postgres(url, {
    max: 4,
    prepare: false,
    idle_timeout: 60,
    connect_timeout: 15,
    ssl: isLocal ? false : "require"
  });
  return _sharedPg;
}

/**
 * Runs `fn` with a short-lived direct-Postgres connection when DATABASE_URL is configured,
 * always closing the connection afterward. Returns null if DATABASE_URL isn't set, so
 * callers can fall back to the Supabase client path.
 */
export async function withLocalPg<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T | null> {
  const url = getDbUrl();
  if (!url) return null;
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(url);
  const sql = postgres(url, {
    max: 1,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: isLocal ? false : "require"
  });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
