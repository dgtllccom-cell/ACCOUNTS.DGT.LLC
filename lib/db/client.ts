import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

export function createDbClient() {
  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require";

  const queryClient = postgres(dbUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    ssl: "require"
  });

  return drizzle(queryClient, { schema });
}

// Build-safe lazy initialization.
//
// The Postgres connection pool must NOT be created at module-import time, or Next.js
// page-data collection during `next build` (which imports every route module) can crash
// when DATABASE_URL is absent in the build environment. We create the client lazily on
// first real use (at request time), so environment validation never runs during import.
type DbClient = ReturnType<typeof createDbClient>;

let cachedDb: DbClient | null = null;

function getDb(): DbClient {
  if (!cachedDb) {
    cachedDb = createDbClient();
  }
  return cachedDb;
}

export const db = new Proxy({} as DbClient, {
  get(_target, prop) {
    const client = getDb() as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
  has(_target, prop) {
    return prop in (getDb() as object);
  }
}) as DbClient;
