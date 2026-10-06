/**
 * Pre-flight for migration 20261022. Read-only.
 *
 * For every provisioned per-module language table (public.<base>_<lang> and the
 * recursive <base>_<lang>_<lang> garbage), assert that all of its rows are
 * already preserved in record_translations for the base table. Prints a summary
 * and exits non-zero if ANY row would be lost — i.e. if this exits 0, dropping
 * those tables is data-safe.
 *
 *   node scripts/verify-translation-consolidation-safe.mjs            # uses .env.local DATABASE_URL
 *   DATABASE_URL=... node scripts/verify-translation-consolidation-safe.mjs
 */
import fs from "node:fs";
import postgres from "postgres";

let url = process.env.DATABASE_URL;
if (!url && fs.existsSync(".env.local")) {
  url = (fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, "");
}
if (!url) { console.error("No DATABASE_URL"); process.exit(2); }
const sql = postgres(url, { max: 1, prepare: false, ssl: "require" });

const tables = await sql`
  select c.relname as name
  from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname='public' and c.relkind='r'
    and c.relname ~ '_(en|ur|ar|fa|ps)(_(en|ur|ar|fa|ps))?$'
    and c.relname not in ('translations_english','translations_urdu','translations_arabic','translations_persian','translations_pashto')
    and exists (select 1 from information_schema.columns col where col.table_schema='public' and col.table_name=c.relname and col.column_name='translated_text')
  order by c.relname`;

let total = tables.length, empty = 0, ok = 0, bad = 0;
const problems = [];
for (const { name } of tables) {
  const [{ n }] = await sql`select count(*)::int n from ${sql(name)}`;
  if (n === 0) { empty++; continue; }
  const base = name.replace(/_(en|ur|ar|fa|ps)(_(en|ur|ar|fa|ps))?$/, "");
  const [{ missing }] = await sql`
    select count(*)::int missing from ${sql(name)} t
    where not exists (
      select 1 from public.record_translations rt
      where rt.record_table = ${base} and rt.record_id = t.record_id and rt.field_name = t.field_name
    )`;
  if (missing > 0) { bad++; problems.push(`${name} (base ${base}): ${missing}/${n} rows NOT in record_translations`); }
  else { ok++; console.log(`  ok  ${name.padEnd(42)} ${n} rows all preserved in record_translations[${base}]`); }
}

console.log(`\ntables: ${total} | empty (safe): ${empty} | non-empty verified: ${ok} | UNSAFE: ${bad}`);
if (bad) { console.error("\nUNSAFE — do NOT run 20261022 until these are backfilled:\n" + problems.map(p => "  ✗ " + p).join("\n")); process.exit(1); }
console.log("\n✓ SAFE — every per-module language-table row is preserved in record_translations. 20261022 will not lose data.");
await sql.end();
