import fs from "node:fs";
import postgres from "postgres";

const table = process.argv[2];
if (!table) throw new Error("Missing table arg");

const envText = fs.readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });
try {
  const rows = await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = ${table}
    order by ordinal_position
  `;
  console.log(JSON.stringify(rows.map((row) => row.column_name), null, 2));
} finally {
  await sql.end();
}
