import fs from "node:fs";
import postgres from "postgres";

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
  const tables = [
    "countries",
    "country_branches",
    "city_branches",
    "profiles",
    "user_role_assignments",
    "enterprise_accounts",
    "companies",
    "customers"
  ];
  const results = {};
  for (const table of tables) {
    const rows = await sql.unsafe(`select count(*)::int as c from public.${table}`);
    results[table] = rows[0].c;
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await sql.end();
}
