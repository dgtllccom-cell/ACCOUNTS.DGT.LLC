import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  console.log("=== FINAL VPS PRODUCTION TRACE & CHAIN VERIFICATION ===");

  // 1. Trace Roznamcha Entries with Lines for our test payments
  const rozEntries = await sql`
    SELECT 
      re.id, re.voucher_no, re.journal_no, re.type, re.entry_date, re.status,
      re.super_admin_serial_number, re.country_transaction_serial_number, re.branch_transaction_serial_number,
      re.source_module, re.source_transaction_type, re.original_currency_code, re.base_currency_amount,
      c.name as country_name,
      count(rl.id) as line_count,
      sum(rl.debit) as total_debit,
      sum(rl.credit) as total_credit
    FROM roznamcha_entries re
    LEFT JOIN countries c ON c.id = re.country_id
    LEFT JOIN roznamcha_lines rl ON rl.roznamcha_entry_id = re.id
    WHERE re.created_at >= NOW() - INTERVAL '30 minutes'
    GROUP BY re.id, re.voucher_no, re.journal_no, re.type, re.entry_date, re.status,
             re.super_admin_serial_number, re.country_transaction_serial_number, re.branch_transaction_serial_number,
             re.source_module, re.source_transaction_type, re.original_currency_code, re.base_currency_amount,
             c.name
    ORDER BY re.created_at DESC;
  `;
  console.log("\n--- LATEST ROZNAMCHA POSTINGS AUDIT ---");
  console.table(rozEntries);

  // 2. Trace Purchase Order Payments
  const poPayments = await sql`
    SELECT 
      pop.id, pop.purchase_order_id, po.purchase_order_no, pop.kind, pop.amount, pop.currency_code, pop.exchange_rate,
      pop.base_currency_amount, pop.status, pop.reference_no, pop.created_at,
      re.voucher_no
    FROM purchase_order_payments pop
    JOIN purchase_orders po ON po.id = pop.purchase_order_id
    LEFT JOIN roznamcha_entries re ON re.id = pop.roznamcha_entry_id
    WHERE pop.created_at >= NOW() - INTERVAL '30 minutes'
    ORDER BY pop.created_at DESC;
  `;
  console.log("\n--- LATEST PURCHASE PAYMENTS AUDIT ---");
  console.table(poPayments);

  // 3. Trace Sales Order Payments
  const soPayments = await sql`
    SELECT 
      sop.id, sop.sales_order_id, so.sales_order_no, sop.payment_kind, sop.amount, sop.currency_code, sop.exchange_rate,
      sop.status, sop.remarks, sop.created_at,
      re.voucher_no
    FROM sales_order_payments sop
    JOIN sales_orders so ON so.id = sop.sales_order_id
    LEFT JOIN roznamcha_entries re ON re.id = sop.roznamcha_entry_id
    WHERE sop.created_at >= NOW() - INTERVAL '30 minutes'
    ORDER BY sop.created_at DESC;
  `;
  console.log("\n--- LATEST SALES PAYMENTS AUDIT ---");
  console.table(soPayments);

  await sql.end();
}

main().catch(console.error);
