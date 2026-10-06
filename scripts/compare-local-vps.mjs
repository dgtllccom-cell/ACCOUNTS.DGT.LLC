import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from 'postgres';

const localSql = postgres(resolveDbUrl("dev"), { 
  ssl: { rejectUnauthorized: false },
  prepare: false 
});
const vpsSql = postgres(resolveDbUrl("prod"), { 
  ssl: { rejectUnauthorized: false },
  prepare: false 
});

const tables = [
  'companies', 'banks', 'warehouses', 'customers', 'employees', 'accounts',
  'goods', 'goods_variations', 'products', 'branches', 'country_branches', 'city_branches',
  'ports', 'company_registration_types', 'contact_types', 'document_types', 'account_types',
  'tax_codes', 'product_units', 'product_brands', 'product_categories',
  'account_companies', 'account_customer_owners', 'account_banks', 'account_warehouses',
  'customer_contacts', 'customer_registrations',
  'stock_movements', 'product_inventory_balances',
  'journal_entries', 'journal_lines', 'roznamcha_entries',
  'local_purchases', 'purchase_orders', 'purchase_order_items', 'purchase_loading_records',
  'sales_orders', 'expenses_bills', 'expenses_bill_lines', 'enterprise_accounts', 'ledgers',
  'record_translations'
];

async function compare() {
  const diffs = [];
  for (const t of tables) {
    let localC = 0;
    let vpsC = 0;
    try {
      const resL = await localSql`SELECT count(*) as c FROM ${localSql(t)}`;
      localC = Number(resL[0].c);
    } catch (e) { localC = 'N/A'; }
    try {
      const resV = await vpsSql`SELECT count(*) as c FROM ${vpsSql(t)}`;
      vpsC = Number(resV[0].c);
    } catch (e) { vpsC = 'N/A'; }

    diffs.push({ Table: t, 'Local Count': localC, 'VPS Count': vpsC, Status: localC === vpsC ? 'EQUAL' : (vpsC > localC ? 'VPS_HAS_MORE' : 'NEEDS_MIGRATION') });
  }
  console.table(diffs);
  await localSql.end();
  await vpsSql.end();
}

compare().catch(console.error);
