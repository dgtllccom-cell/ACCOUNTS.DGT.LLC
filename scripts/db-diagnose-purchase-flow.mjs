import fs from "node:fs";
import postgres from "postgres";

function loadEnv(path) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(".env.local");
loadEnv(".env");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");
const sql = postgres(url, { ssl: "require", max: 1, idle_timeout: 5 });

try {
  const summary = await sql`
    select
      count(*)::int as total_payments,
      count(*) filter (where status = 'posted')::int as posted_payments,
      count(*) filter (where roznamcha_entry_id is null)::int as missing_roznamcha,
      count(*) filter (where debit_ledger_id is null or credit_ledger_id is null)::int as missing_ledgers
    from purchase_order_payments
    where deleted_at is null;
  `;

  const lineIssues = await sql`
    select
      p.id,
      p.purchase_order_id,
      p.kind,
      p.amount,
      p.currency_code,
      p.status,
      p.roznamcha_entry_id,
      po.purchase_order_no,
      count(l.id)::int as line_count,
      coalesce(sum(l.debit), 0)::numeric as debit_total,
      coalesce(sum(l.credit), 0)::numeric as credit_total,
      re.super_admin_serial_number,
      re.country_transaction_serial_number,
      re.branch_transaction_serial_number,
      re.source_module,
      re.source_transaction_type
    from purchase_order_payments p
    left join purchase_orders po on po.id = p.purchase_order_id
    left join roznamcha_entries re on re.id = p.roznamcha_entry_id
    left join roznamcha_lines l on l.roznamcha_entry_id = p.roznamcha_entry_id
    where p.deleted_at is null
      and p.status = 'posted'
    group by p.id, po.purchase_order_no, re.id
    having count(l.id) < 2
       or coalesce(sum(l.debit), 0) <= 0
       or coalesce(sum(l.credit), 0) <= 0
       or re.super_admin_serial_number is null
       or re.country_transaction_serial_number is null
       or re.branch_transaction_serial_number is null
    order by p.created_at desc
    limit 20;
  `;

  const recentOrders = await sql`
    select
      id,
      purchase_order_no,
      currency_code,
      exchange_rate,
      order_total,
      advance_paid,
      remaining_paid,
      credit_amount,
      remaining_due,
      payment_status,
      ledger_posting_status,
      super_admin_serial_number,
      country_transaction_serial_number,
      branch_transaction_serial_number,
      created_at
    from purchase_orders
    where deleted_at is null
    order by created_at desc
    limit 10;
  `;

  console.log(JSON.stringify({ summary: summary[0], brokenPostedPayments: lineIssues, recentOrders }, null, 2));
} finally {
  await sql.end();
}
