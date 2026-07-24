import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

export function createDbClient() {
  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";

  const queryClient = postgres(dbUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false
  });

  return drizzle(queryClient, { schema });
}

export const db = createDbClient();
