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
const sql = postgres(env.DATABASE_URL, { max: 5 });

async function main() {
  console.log("=================================================");
  console.log("📦 EXECUTING SAMPLE PURCHASE BILL TRANSFERS");
  console.log("=================================================");

  // Query untransferred purchase orders
  const pendingOrders = await sql`
    SELECT id, purchase_order_no, purchase_contract_no, order_total, advance_paid, 
           credit_amount, currency_code, ledger_posting_status
    FROM purchase_orders
    WHERE deleted_at IS NULL
      AND (ledger_posting_status IS NULL OR ledger_posting_status != 'posted')
      AND order_total > 0
    ORDER BY created_at DESC
    LIMIT 5
  `;

  console.log(`\n📋 Pending Untransferred Orders (${pendingOrders.length} records):`);
  console.table(pendingOrders.map(o => ({
    PO_No: o.purchase_order_no,
    Contract: o.purchase_contract_no,
    Total: o.order_total,
    Advance: o.advance_paid,
    Credit: o.credit_amount,
    Currency: o.currency_code,
    Posting: o.ledger_posting_status
  })));

  // Verify transferred orders and their roznamcha entries
  const transferredOrders = await sql`
    SELECT po.id, po.purchase_order_no, po.purchase_contract_no, po.order_total, po.advance_paid,
           po.credit_amount, po.currency_code, po.ledger_posting_status,
           pop.id as payment_id, pop.roznamcha_entry_id, pop.amount as payment_amount,
           r.voucher_no, r.super_admin_serial_number, r.country_transaction_serial_number,
           r.branch_transaction_serial_number, r.status as roznamcha_status
    FROM purchase_orders po
    JOIN purchase_order_payments pop ON pop.purchase_order_id = po.id AND pop.deleted_at IS NULL
    LEFT JOIN roznamcha_entries r ON r.id = pop.roznamcha_entry_id
    WHERE po.deleted_at IS NULL
    ORDER BY pop.created_at DESC
    LIMIT 10
  `;

  console.log(`\n✅ Transferred Orders in System (${transferredOrders.length} records):`);
  console.table(transferredOrders.map(t => ({
    PO_No: t.purchase_order_no,
    Total: t.order_total,
    Payment: t.payment_amount,
    Voucher: t.voucher_no,
    Super_Serial: t.super_admin_serial_number,
    Country_Serial: t.country_transaction_serial_number,
    Branch_Serial: t.branch_transaction_serial_number,
    Roz_Status: t.roznamcha_status
  })));

  // For each transferred order, verify the balanced Debit / Credit lines in Roznamcha & General Ledger
  if (transferredOrders.length > 0) {
    const rozId = transferredOrders[0].roznamcha_entry_id;
    if (rozId) {
      const lines = await sql`
        SELECT rl.id, rl.debit, rl.credit, rl.currency, rl.usd_amount,
               l.code as ledger_code, l.name as ledger_name, rl.description
        FROM roznamcha_lines rl
        LEFT JOIN ledgers l ON l.id = rl.ledger_id
        WHERE rl.roznamcha_entry_id = ${rozId}
      `;
      console.log(`\n📋 Balanced GL & Roznamcha Lines for Order ${transferredOrders[0].purchase_order_no} (Roznamcha ID: ${rozId}):`);
      console.table(lines);
    }
  }

  await sql.end();
}

main().catch(console.error);
