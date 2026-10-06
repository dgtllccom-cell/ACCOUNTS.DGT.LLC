/**
 * Data correction (QA — Customer Order / Truck Loading): a master `countries`
 * row was created as "chian" (typo for "China"). Order CL-ORD-2026-0005 and its
 * denormalised name columns + record_translations all show "chian".
 *
 * Fix: rename the master row to "China" and re-sync the denormalised copies +
 * translation sidecar. Idempotent. Read-only until --apply is passed.
 *
 *   node scripts/fix-chian-country-typo.mjs           # dry run (shows what it would change)
 *   node scripts/fix-chian-country-typo.mjs --apply   # perform the correction
 */
import fs from "node:fs";
import postgres from "postgres";

const APPLY = process.argv.includes("--apply");
let url = process.env.DATABASE_URL;
if (!url && fs.existsSync(".env.local")) {
  url = (fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, "");
}
const sql = postgres(url, { max: 1, prepare: false, ssl: "require" });

const typos = await sql`select id, name from countries where name ~* '^chian$'`;
if (!typos.length) { console.log("Nothing to fix — no country named 'chian'."); await sql.end(); process.exit(0); }

for (const c of typos) {
  console.log(`countries ${c.id}: "${c.name}" -> "China"`);
  const orders = await sql`select id, order_no, loading_country_name, receiving_country_name, route_name from clearing_customer_orders where loading_country_id = ${c.id} or loading_country_name ~* '^chian$' or route_name ~* 'chian'`;
  orders.forEach((o) => console.log(`  order ${o.order_no}: loading_country_name="${o.loading_country_name}" route_name="${o.route_name}"`));

  if (!APPLY) continue;

  await sql`update countries set name = 'China', updated_at = now() where id = ${c.id}`;
  await sql`update clearing_customer_orders
    set loading_country_name = regexp_replace(loading_country_name, 'chian', 'China', 'gi'),
        route_name           = regexp_replace(route_name, 'chian', 'China', 'gi'),
        updated_at = now()
    where loading_country_id = ${c.id} or loading_country_name ~* 'chian' or route_name ~* 'chian'`;
  // translation sidecar: the app rewrites these on next save, but correct them now too
  await sql`update translations_english set text = regexp_replace(text, 'chian', 'China', 'gi'), updated_at = now()
    where record_table = 'clearing_customer_orders' and field_name in ('loading_country_name','route_name') and text ~* 'chian'`;
  for (const t of ['urdu', 'arabic', 'persian', 'pashto']) {
    await sql.unsafe(`update translations_${t} set text = regexp_replace(text, 'چیان|chian', 'China', 'gi'), updated_at = now()
      where record_table = 'clearing_customer_orders' and field_name in ('loading_country_name','route_name') and text ~* 'چیان|chian'`);
  }
  await sql`update countries set name = 'China' where id = ${c.id}`;
}

console.log(APPLY ? "\n✓ applied." : "\n(dry run — pass --apply to perform)");
await sql.end();
