import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from "postgres";

const vpsEnv = {
  DATABASE_URL: resolveDbUrl("prod")
};
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } });

async function verifyLiveDbState() {
  console.log("=================================================================================");
  console.log("                LIVE VPS DATABASE INTEGRITY & DATA VERIFICATION                  ");
  console.log("=================================================================================\n");

  // 1. Stock Movements
  const movements = await vpsSql`
    SELECT sm.id, sm.movement_type, sm.quantity, sm.unit_cost, sm.total_amount, g.goods_name, w.warehouse_name
    FROM public.stock_movements sm
    LEFT JOIN public.goods g ON g.id = sm.goods_id
    LEFT JOIN public.warehouses w ON w.id = sm.warehouse_id
    LIMIT 5
  `;
  console.log("1. Stock Movements Sample on VPS:", movements);

  // 2. Inventory Balances
  const balances = await vpsSql`
    SELECT pib.product_id, pib.quantity_on_hand, pib.quantity_available, g.goods_name, w.warehouse_name
    FROM public.product_inventory_balances pib
    LEFT JOIN public.goods g ON g.id = pib.product_id
    LEFT JOIN public.warehouses w ON w.id = pib.warehouse_id
    LIMIT 5
  `;
  console.log("\n2. Inventory Balances Sample on VPS:", balances);

  // 3. Account Multi-Linking Tables
  const accCompanies = await vpsSql`SELECT COUNT(*)::int FROM public.account_companies`;
  const accBanks = await vpsSql`SELECT COUNT(*)::int FROM public.account_banks`;
  const accWarehouses = await vpsSql`SELECT COUNT(*)::int FROM public.account_warehouses`;
  const accCustomers = await vpsSql`SELECT COUNT(*)::int FROM public.account_customer_owners`;

  console.log("\n3. Account Multi-Linking Records on VPS:");
  console.log(`   - account_companies: ${accCompanies[0].count}`);
  console.log(`   - account_banks: ${accBanks[0].count}`);
  console.log(`   - account_warehouses: ${accWarehouses[0].count}`);
  console.log(`   - account_customer_owners: ${accCustomers[0].count}`);

  // 4. Record Translations
  const transCount = await vpsSql`SELECT COUNT(*)::int FROM public.record_translations WHERE deleted_at IS NULL`;
  console.log(`\n4. Record Translations on VPS: ${transCount[0].count} / 9442 records`);

  await vpsSql.end();
  process.exit(0);
}

verifyLiveDbState();
