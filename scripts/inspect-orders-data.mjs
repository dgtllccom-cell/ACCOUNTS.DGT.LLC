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
  const orders = await sql`
    SELECT id, order_no, customer_name, current_stage, status, created_by, created_at
    FROM public.clearing_customer_orders
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 10
  `;
  console.log(`Found ${orders.length} orders:`);
  for (const o of orders) {
    console.log(`- ${o.order_no} | Stage: ${o.current_stage} | Status: ${o.status} | Customer: ${o.customer_name} | CreatedBy: ${o.created_by}`);
  }
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
