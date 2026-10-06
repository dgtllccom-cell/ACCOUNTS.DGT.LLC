import fs from 'node:fs';
import postgres from 'postgres';

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, '');
  }
  return env;
}

const env = { ...parseEnvFile('.env'), ...parseEnvFile('.env.local') };
const sql = postgres(env.DATABASE_URL, { max: 2 });

async function run() {
  const tables = ['roznamcha_entries', 'roznamcha_lines', 'purchase_order_payments', 'purchase_orders'];
  for (const t of tables) {
    const cols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = ${t}
      ORDER BY ordinal_position
    `;
    console.log(`\n=== Table: ${t} (${cols.length} columns) ===`);
    console.log(cols.map(c => `${c.column_name} (${c.data_type})`).join(', '));
  }

  const pos = await sql`SELECT * FROM purchase_orders WHERE deleted_at IS NULL LIMIT 5`;
  console.log("\n=== Purchase Orders Sample ===");
  console.log(pos.map(p => ({
    id: p.id,
    no: p.purchase_order_no,
    contract: p.purchase_contract_no,
    status: p.status,
    posting: p.ledger_posting_status,
    total: p.order_total,
    advance: p.advance_paid,
    credit: p.credit_amount,
    currency: p.currency_code
  })));

  const roz = await sql`SELECT * FROM roznamcha_entries WHERE deleted_at IS NULL LIMIT 5`;
  console.log("\n=== Roznamcha Entries Sample ===");
  console.log(roz.map(r => ({
    id: r.id,
    voucher: r.voucher_no,
    super_serial: r.super_admin_serial_number,
    country_serial: r.country_transaction_serial_number,
    branch_serial: r.branch_transaction_serial_number,
    status: r.status,
    category: r.entry_category,
    source: r.source_module,
    created: r.created_at
  })));

  await sql.end();
}

run().catch(console.error);
