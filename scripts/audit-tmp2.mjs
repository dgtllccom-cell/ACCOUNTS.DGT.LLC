import fs from "node:fs";
import postgres from "postgres";
function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i)] = t.slice(i + 1).replace(/^"|"$/g, "");
  }
  return env;
}
const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const sql = postgres(env.DATABASE_URL, { ssl: "require", max: 4 });

console.log("=== countries: actual translated values ===");
const c = await sql`
  select c.name as english_name, rt.urdu_text, rt.arabic_text, rt.persian_text, rt.pashto_text
  from countries c
  join record_translations rt on rt.record_table = 'countries' and rt.record_id = c.id and rt.field_name = 'name' and rt.deleted_at is null
  order by c.name limit 10
`;
console.log(JSON.stringify(c, null, 2));

console.log("=== companies: orphan check (translation rows with no matching company) ===");
const orphan = await sql`
  select count(*)::int as orphan_count
  from record_translations rt
  where rt.record_table = 'companies' and rt.field_name = 'name' and rt.deleted_at is null
    and not exists (select 1 from companies c where c.id = rt.record_id)
`;
console.log(JSON.stringify(orphan));

console.log("=== companies: duplicate rows per record_id ===");
const dup = await sql`
  select record_id, count(*)::int as n
  from record_translations
  where record_table = 'companies' and field_name = 'name' and deleted_at is null
  group by record_id having count(*) > 1
  order by n desc limit 5
`;
console.log(JSON.stringify(dup, null, 2));

console.log("=== employees table columns ===");
const ecols = await sql`select column_name from information_schema.columns where table_name = 'employees' order by ordinal_position`;
console.log(JSON.stringify(ecols.map(r => r.column_name)));

console.log("=== journal_entries / journal_lines row counts (any status) ===");
const je = await sql`select to_regclass('public.journal_entries') as reg1, to_regclass('public.journal_lines') as reg2`;
console.log(JSON.stringify(je));

await sql.end();
