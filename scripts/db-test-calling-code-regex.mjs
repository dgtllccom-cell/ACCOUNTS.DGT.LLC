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

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

try {
  const rows = await sql.unsafe(`
    select
      '+92' ~ '^\\\\+[0-9]{1,6}$' as ok_backslash,
      '+92' ~ '^\\+[0-9]{1,6}$' as ok_escape_plus,
      '+92' ~ '^\\+[0-9]+$' as ok_simple
  `);
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await sql.end();
}

