import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

try {
  const [schema] = await sql`select to_regclass('public.companies') as companies`;

  if (schema.companies) {
    console.log("schema already present");
  } else {
    const migration = fs.readFileSync("supabase/migrations/0001_foundation.sql", "utf8");
    await sql.unsafe(migration);
    console.log("foundation migration applied");
  }
} finally {
  await sql.end();
}
