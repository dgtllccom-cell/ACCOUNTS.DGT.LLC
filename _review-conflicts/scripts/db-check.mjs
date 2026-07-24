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
  await sql`select now()`;
  const [schema] = await sql`select to_regclass('public.companies') as companies`;
  console.log(schema.companies ? "schema already present" : "schema not present");
} finally {
  await sql.end();
}
