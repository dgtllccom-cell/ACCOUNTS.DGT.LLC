import { defineConfig } from "drizzle-kit";
import fs from "node:fs";

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!fs.existsSync(".env.local")) return "";

  const line = fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith("DATABASE_URL="));

  return line ? line.slice(line.indexOf("=") + 1).trim() : "";
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./supabase/migrations/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: readDatabaseUrl()
  },
  strict: true
});
