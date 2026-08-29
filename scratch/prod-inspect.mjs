import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
import postgres from "postgres";

const PROD_URL = resolveDbUrl("prod");

const sql = postgres(PROD_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1,
  prepare: false,
});

try {
  const tag = "PROD-SANA-TEST";
  const counts = await sql`
    select
      (select count(*) from purchase_orders where deleted_at is null and coalesce(form_data->>'seedTag','') = ${tag}) as purchase_orders,
      (select count(*) from purchase_order_items poi join purchase_orders po on po.id = poi.purchase_order_id where po.deleted_at is null and coalesce(po.form_data->>'seedTag','') = ${tag}) as purchase_order_items,
      (select count(*) from purchase_order_payments pop join purchase_orders po on po.id = pop.purchase_order_id where pop.deleted_at is null and coalesce(po.form_data->>'seedTag','') = ${tag}) as purchase_order_payments,
      (select count(*) from purchase_loading_records plr join purchase_orders po on po.id = plr.purchase_order_id where plr.deleted_at is null and coalesce(po.form_data->>'seedTag','') = ${tag}) as purchase_loading_records,
      (select count(*) from roznamcha_entries where deleted_at is null and coalesce(source_reference_no,'') like ${`${tag}%`}) as roznamcha_entries
  `;
  console.log("SOURCE_TAG_COUNTS");
  console.log(JSON.stringify(counts, null, 2));

  const cols = await sql`
    select column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'public' and table_name = 'local_purchases'
    order by ordinal_position
  `;
  console.log("LOCAL_PURCHASE_COLUMNS");
  console.log(JSON.stringify(cols, null, 2));

  const sanaCompanies = await sql`
    select id, name, legal_name, owner_name, country_name, city_name
    from companies
    where deleted_at is null
      and (name ilike '%sana%' or legal_name ilike '%sana%' or owner_name ilike '%sana%')
    order by name
    limit 20
  `;
  console.log("SANA_COMPANIES");
  console.log(JSON.stringify(sanaCompanies, null, 2));
} finally {
  await sql.end({ timeout: 10 });
}
