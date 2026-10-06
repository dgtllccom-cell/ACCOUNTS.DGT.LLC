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
const dbUrl = env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 5 });

async function main() {
  console.log("=================================================");
  console.log("🚀 TESTING PURCHASE BOOKING TRANSFER & PAYMENT FLOW");
  console.log("=================================================");

  // 1. Inspect table schemas
  const popCols = await sql`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'purchase_order_payments'
  `;
  console.log("Columns in purchase_order_payments:", popCols.map(c => c.column_name).join(", "));

  // 2. Inspect purchase orders
  const allOrders = await sql`
    SELECT id, purchase_order_no, purchase_contract_no, status, ledger_posting_status, 
           order_total, advance_paid, remaining_paid, credit_amount, currency_code,
           country_id, country_branch_id, city_branch_id
    FROM purchase_orders
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 20
  `;

  console.log(`\n📋 Found ${allOrders.length} active purchase orders:`);
  console.table(allOrders.map(o => ({
    id: o.id,
    po_no: o.purchase_order_no,
    contract: o.purchase_contract_no,
    status: o.status,
    posting: o.ledger_posting_status,
    total: o.order_total,
    advance: o.advance_paid,
    credit: o.credit_amount,
    currency: o.currency_code
  })));

  // 3. Inspect recent Roznamcha entries & serial sequence
  const rozEntries = await sql`
    SELECT id, voucher_no, super_admin_serial_number, country_transaction_serial_number,
           branch_transaction_serial_number, source_module, source_transaction_type,
           status, entry_category, total_amount, currency_code, created_at
    FROM roznamcha_entries
    ORDER BY created_at DESC
    LIMIT 10
  `;
  console.log("\n📋 Recent Roznamcha Entries (Daily Books & Serials):");
  console.table(rozEntries);

  // 4. Inspect Roznamcha Debit / Credit lines for transferred entries
  if (rozEntries.length > 0) {
    const latestRozId = rozEntries[0].id;
    const lines = await sql`
      SELECT rl.id, rl.roznamcha_entry_id, rl.ledger_id, l.name as ledger_name, l.code as ledger_code,
             rl.debit, rl.credit, rl.currency_code, rl.exchange_rate, rl.narration
      FROM roznamcha_lines rl
      LEFT JOIN ledgers l ON l.id = rl.ledger_id
      WHERE rl.roznamcha_entry_id = ${latestRozId}
    `;
    console.log(`\n🔍 Journal Lines for Latest Roznamcha Entry (${rozEntries[0].voucher_no || latestRozId}):`);
    console.table(lines);
  }

  // 5. Inspect payments
  const payments = await sql`
    SELECT * FROM purchase_order_payments 
    WHERE deleted_at IS NULL 
    ORDER BY created_at DESC 
    LIMIT 10
  `;
  console.log("\n💳 Recent Purchase Order Payments Records:");
  console.table(payments.map(p => ({
    id: p.id,
    po_id: p.purchase_order_id,
    kind: p.kind,
    amount: p.amount,
    currency: p.currency_code,
    roznamcha_id: p.roznamcha_entry_id,
    created: p.created_at
  })));

  await sql.end();
}

main().catch(console.error);
