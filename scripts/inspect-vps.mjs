import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from 'postgres';

const vpsEnv = { DATABASE_URL: resolveDbUrl("prod") };
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 5, ssl: { rejectUnauthorized: false } });

async function main() {
  const vpsPO = await vpsSql`SELECT id, purchase_order_no, super_admin_serial_number FROM purchase_orders`;
  console.log('VPS POs:', vpsPO);
  const vpsRoz = await vpsSql`SELECT id, voucher_no, super_admin_serial_number FROM roznamcha_entries`;
  console.log('VPS Roznamcha:', vpsRoz);
  await vpsSql.end();
}

main().catch(console.error);
