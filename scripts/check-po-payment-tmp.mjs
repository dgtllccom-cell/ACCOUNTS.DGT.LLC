import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

const poNo = process.argv[2];
if (!poNo) {
  console.error("Usage: node check-po-payment-tmp.mjs <purchase_order_no>");
  process.exit(1);
}

const orders = await sql`
  select id, purchase_order_no, purchase_contract_no, currency_code, exchange_rate,
         order_total, advance_paid, remaining_paid, credit_amount, remaining_due,
         payment_status, ledger_posting_status, country_id, country_branch_id, city_branch_id
  from purchase_orders where purchase_order_no = ${poNo} and deleted_at is null
`;
console.log("=== PURCHASE ORDER ===");
console.table(orders);

if (orders.length === 0) {
  await sql.end();
  process.exit(0);
}

const order = orders[0];

const payments = await sql`
  select id, kind, amount, currency_code, exchange_rate, debit_ledger_id, credit_ledger_id,
         roznamcha_entry_id, status, reference_no, narration, created_at
  from purchase_order_payments
  where purchase_order_id = ${order.id} and deleted_at is null
  order by created_at asc
`;
console.log("=== PAYMENTS ===");
console.table(payments.map(p => ({ ...p, narration: (p.narration||"").slice(0,40) })));

for (const p of payments) {
  if (!p.roznamcha_entry_id) continue;
  const roz = await sql`
    select id, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number,
           entry_date, type, status
    from roznamcha_entries where id = ${p.roznamcha_entry_id}
  `;
  console.log(`--- Roznamcha for payment ${p.id} (kind=${p.kind}) ---`);
  console.table(roz);

  const lines = await sql`
    select id, ledger_id, debit, credit, currency, usd_rate, usd_amount
    from roznamcha_lines where roznamcha_entry_id = ${p.roznamcha_entry_id}
  `;
  console.table(lines);

  for (const l of lines) {
    const led = await sql`select code, name, current_balance, normal_balance, currency from ledgers where id = ${l.ledger_id}`;
    console.log(`  ledger ${l.ledger_id} -> ${led[0]?.code} ${led[0]?.name} bal=${led[0]?.current_balance} ${led[0]?.currency} (${led[0]?.normal_balance})`);
  }
}

await sql.end();
