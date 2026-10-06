/**
 * Environment separation guard.
 *
 * Purpose: guarantee that the PRODUCTION deployment can only ever talk to the
 * PRODUCTION Supabase project, and that DEVELOPMENT can never accidentally talk
 * to the production database. This prevents the "dev and prod share one DB"
 * problem where every local change is written straight to production.
 *
 * Core rules (hard fail = throws, refusing to boot / open a connection):
 *   • APP_ENV === "production"  → active Supabase ref MUST equal the prod ref.
 *   • APP_ENV !== "production"  → active Supabase ref MUST NOT equal the prod ref.
 *   • The ref implied by NEXT_PUBLIC_SUPABASE_URL and the ref implied by
 *     DATABASE_URL must agree (catches half-migrated env files).
 *
 * The production ref is fixed here as the source of truth, but every value can
 * be overridden with environment variables so nothing is silently hard-coded:
 *   APP_ENV           = "production" | "development" (defaults to NODE_ENV)
 *   PROD_SUPABASE_REF = project ref that identifies production
 *   DEV_SUPABASE_REF  = (optional) project ref that identifies development
 */

export type AppEnvironment = "production" | "development";

/** Production Supabase project ref (override with PROD_SUPABASE_REF). */
const DEFAULT_PROD_REF = "inmayhrxucimxqhgseqi";

/** Current dev/live Supabase project ref (override with DEV_SUPABASE_REF). */
const DEFAULT_DEV_REF = "csesvyxxjivnkkozgopt";

export function getAppEnvironment(): AppEnvironment {
  // Check browser host first
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1" && !host.startsWith("192.168.") && !host.endsWith(".local")) {
      return "production";
    }
  }

  const raw = (
    process.env.APP_ENV ||
    process.env.NEXT_PUBLIC_APP_ENV ||
    (typeof window === "undefined" ? process.env.NODE_ENV : "") ||
    "development"
  ).trim().toLowerCase();
  return raw === "production" ? "production" : "development";
}

export function getProdRef(): string {
  return (process.env.PROD_SUPABASE_REF || process.env.NEXT_PUBLIC_PROD_SUPABASE_REF || DEFAULT_PROD_REF).trim();
}

export function getDevRef(): string {
  return (process.env.DEV_SUPABASE_REF || process.env.NEXT_PUBLIC_DEV_SUPABASE_REF || DEFAULT_DEV_REF).trim();
}

/** Extract the project ref from a Supabase API URL: https://<ref>.supabase.co */
export function refFromSupabaseUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const match = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.(co|in|net)/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Extract the project ref from a Postgres connection string. Handles both:
 *   • Direct:  postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres
 *   • Pooler:  postgresql://postgres.<ref>:<pw>@aws-1-...pooler.supabase.com:6543/postgres
 */
export function refFromDatabaseUrl(dbUrl: string | undefined | null): string | null {
  if (!dbUrl) return null;
  const direct = dbUrl.match(/@db\.([a-z0-9]+)\.supabase\./i);
  if (direct) return direct[1].toLowerCase();
  const pooler = dbUrl.match(/\/\/postgres\.([a-z0-9]+):/i);
  if (pooler) return pooler[1].toLowerCase();
  return null;
}

export interface EnvironmentIntegrity {
  appEnv: AppEnvironment;
  supabaseRef: string | null;
  databaseRef: string | null;
  prodRef: string;
}

/**
 * Assert that the wired database matches the declared environment.
 * Throws (hard fail) on any mismatch on the server. Safe to call on both server and client.
 */
export function assertEnvironmentIntegrity(): EnvironmentIntegrity {
  let appEnv = getAppEnvironment();
  const prodRef = getProdRef();
  const devRef = getDevRef();

  const supabaseRef = refFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const databaseRef = refFromDatabaseUrl(process.env.DATABASE_URL);

  const activeRef = supabaseRef ?? databaseRef;
  const isServer = typeof window === "undefined";

  // If client is pointed at the production project URL, consider it production environment
  if (!isServer && activeRef === prodRef) {
    appEnv = "production";
  }

  // 1. Supabase URL ref and DATABASE_URL ref must agree when both are present.
  if (supabaseRef && databaseRef && supabaseRef !== databaseRef) {
    const msg =
      `[ENV GUARD] Configuration split-brain: NEXT_PUBLIC_SUPABASE_URL points at ` +
      `"${supabaseRef}" but DATABASE_URL points at "${databaseRef}". ` +
      `Both must reference the same Supabase project.`;
    if (isServer) throw new Error(msg + " Refusing to start.");
    else console.error(msg);
  }

  // 2. In production, the active project MUST be the production project.
  if (appEnv === "production") {
    if (!activeRef) {
      const msg =
        "[ENV GUARD] Running in production but no Supabase project is configured " +
        "(NEXT_PUBLIC_SUPABASE_URL / DATABASE_URL are empty).";
      if (isServer) throw new Error(msg + " Refusing to start.");
      else console.error(msg);
    } else if (activeRef !== prodRef) {
      const msg =
        `[ENV GUARD] Production is pointed at Supabase project "${activeRef}", ` +
        `but the production project is "${prodRef}". A production deploy must only ` +
        `use the production database.`;
      if (isServer) throw new Error(msg + " Refusing to start.");
      else console.error(msg);
    }
  }

  // 3. In development, the active project MUST NOT be the production project on server.
  if (appEnv !== "production" && activeRef && activeRef === prodRef) {
    const msg =
      `[ENV GUARD] Development is pointed at the PRODUCTION Supabase project ` +
      `"${prodRef}". Local/dev work must never write to production. ` +
      `Point DATABASE_URL / NEXT_PUBLIC_SUPABASE_URL at the dev project ` +
      `("${devRef}").`;
    if (isServer) {
      throw new Error(msg + " Refusing to start.");
    } else {
      console.warn(msg);
    }
  }

  return { appEnv, supabaseRef, databaseRef, prodRef };
}

let verified = false;

/** Runs the integrity check once per process. Cheap to call from hot paths. */
export function ensureEnvironmentVerifiedOnce(): void {
  if (verified) return;
  assertEnvironmentIntegrity();
  verified = true;
}
