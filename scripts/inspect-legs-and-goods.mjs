import fs from 'node:fs';
import postgres from 'postgres';

function parseEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).replace(/^"|"$/g, '');
  }
  return env;
}

const env = { ...parseEnv('.env'), ...parseEnv('.env.local') };
const sql = postgres(env.DATABASE_URL, { max: 1 });

async function check() {
  const tables = ['clearing_customer_orders', 'clearing_customer_order_legs', 'clearing_customer_order_goods_verifications'];
  for (const tableName of tables) {
    const cols = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = ${tableName}
      ORDER BY ordinal_position
    `;
    console.log(`\n=== Table: ${tableName} ===`);
    for (const col of cols) {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    }
  }
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
