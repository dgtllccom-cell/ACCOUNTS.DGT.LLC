import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

export function createDbClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database operations.");
  }

  const queryClient = postgres(process.env.DATABASE_URL, {
    max: 1,
    prepare: false
  });

  return drizzle(queryClient, { schema });
}

export const db = createDbClient();
