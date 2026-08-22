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

// One representative field per table (the primary user-facing name), taken from
// lib/i18n/translatable-fields.ts. Tables with multiple fields are summarized by
// their most prominent one; this matches how the app itself resolves display names.
const TABLES = [
  ["companies", "name"],
  ["customers", "customer_name"],
  ["banks", "bank_name"],
  ["accounts", "name"],
  ["ledgers", "name"],
  ["employees", "full_name"],
  ["warehouses", "warehouse_name"],
  ["countries", "name"],
  ["branches", "name"],
  ["country_branches", "name"],
  ["city_branches", "name"],
  ["states_provinces", "name"],
  ["districts", "name"],
  ["cities", "name"],
  ["ports", "port_name"],
  ["shipping_line_records", "shipping_line_name"],
  ["clearing_agents", "name"],
  ["goods", "goods_name"],
  ["goods_variations", "brand"],
  ["product_categories", "category_name"],
  ["product_brands", "brand_name"],
  ["product_units", "unit_name"],
  ["purchase_order_items", "goods_name"],
  ["sales_orders", "customer_name"],
  ["roznamcha_entries", "narration"],
  ["roznamcha_lines", "description"],
  ["journal_entries", "memo"],
  ["journal_lines", "description"],
  ["purchase_order_payments", "narration"],
  ["sales_order_payments", "remarks"],
  ["purchase_order_expenses", "description"],
  ["purchase_loading_records", "carrier_name"],
];

function realTableName(t) {
  // purchase_order_items/sales_orders etc are real base tables; all names above match 1:1.
  return t;
}

const rows = [];
for (const [table, field] of TABLES) {
  let totalRows = null;
  let translatableRows = null;
  try {
    const totalQ = await sql.unsafe(`select count(*)::int as c from ${realTableName(table)} where deleted_at is null`);
    totalRows = totalQ[0]?.c ?? null;
  } catch (e) {
    try {
      const totalQ2 = await sql.unsafe(`select count(*)::int as c from ${realTableName(table)}`);
      totalRows = totalQ2[0]?.c ?? null;
    } catch (e2) {
      totalRows = `ERR: ${e2.message}`;
    }
  }
  try {
    const tq = await sql.unsafe(
      `select count(*)::int as c from ${realTableName(table)} where ${field} is not null and trim(${field}::text) <> '' ${typeof totalRows === "number" ? "and deleted_at is null" : ""}`
    );
    translatableRows = tq[0]?.c ?? null;
  } catch (e) {
    try {
      const tq2 = await sql.unsafe(
        `select count(*)::int as c from ${realTableName(table)} where ${field} is not null and trim(${field}::text) <> ''`
      );
      translatableRows = tq2[0]?.c ?? null;
    } catch (e2) {
      translatableRows = `ERR: ${e2.message}`;
    }
  }

  const trRows = await sql`
    select
      count(*)::int as total,
      count(*) filter (where translation_status = 'needs_review')::int as needs_review,
      count(*) filter (where english_text is not null and trim(english_text) <> '')::int as has_en,
      count(*) filter (where urdu_text is not null and trim(urdu_text) <> '' and urdu_text <> english_text)::int as has_ur,
      count(*) filter (where arabic_text is not null and trim(arabic_text) <> '' and arabic_text <> english_text)::int as has_ar,
      count(*) filter (where persian_text is not null and trim(persian_text) <> '' and persian_text <> english_text)::int as has_fa,
      count(*) filter (where pashto_text is not null and trim(pashto_text) <> '' and pashto_text <> english_text)::int as has_ps,
      count(*) filter (
        where urdu_text is not null and trim(urdu_text) <> '' and urdu_text <> english_text
          and arabic_text is not null and trim(arabic_text) <> '' and arabic_text <> english_text
          and persian_text is not null and trim(persian_text) <> '' and persian_text <> english_text
          and pashto_text is not null and trim(pashto_text) <> '' and pashto_text <> english_text
      )::int as complete_all4
    from record_translations
    where record_table = ${table} and deleted_at is null
  `;
  const tr = trRows[0];

  rows.push({ table, field, totalRows, translatableRows, ...tr });
}

console.log(JSON.stringify(rows, null, 2));
await sql.end();
