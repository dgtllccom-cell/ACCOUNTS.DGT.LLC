import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  console.log("=== INSPECTING PRODUCTION DATABASE STATE ===");

  // 1. Countries and Branches
  const countries = await sql`
    SELECT c.id, c.name, 
      (SELECT count(*) FROM country_branches cb WHERE cb.country_id = c.id) as branch_count,
      (SELECT count(*) FROM purchase_orders po WHERE po.country_id = c.id AND po.deleted_at IS NULL) as po_count,
      (SELECT count(*) FROM sales_orders so WHERE so.country_id = c.id AND so.deleted_at IS NULL) as so_count
    FROM countries c
    WHERE c.deleted_at IS NULL
    ORDER BY c.name;
  `;
  console.log("\n--- COUNTRIES & RECORD COUNTS ---");
  console.table(countries);

  // 1b. Branches
  const branches = await sql`
    SELECT cb.id, cb.name as branch_name, c.name as country_name, cb.country_id
    FROM country_branches cb
    JOIN countries c ON c.id = cb.country_id
    WHERE cb.deleted_at IS NULL
    ORDER BY c.name, cb.name;
  `;
  console.log("\n--- BRANCHES ---");
  console.table(branches);

  // 2. Sample Existing Purchase Orders
  const pos = await sql`
    SELECT po.id, po.purchase_order_no, po.purchase_contract_no, c.name as country, cb.name as branch,
           po.currency_code, po.exchange_rate, po.order_total, po.advance_paid, po.remaining_paid, po.credit_amount,
           po.remaining_due, po.payment_status, po.ledger_posting_status, po.created_at
    FROM purchase_orders po
    LEFT JOIN countries c ON c.id = po.country_id
    LEFT JOIN country_branches cb ON cb.id = po.country_branch_id
    WHERE po.deleted_at IS NULL
    ORDER BY po.created_at DESC
    LIMIT 15;
  `;
  console.log("\n--- EXISTING PURCHASE ORDERS (Latest 15) ---");
  console.table(pos);

  // 3. Sample Existing Sales Orders
  const sos = await sql`
    SELECT so.id, so.sales_order_no, so.sales_contract_no, c.name as country, cb.name as branch,
           so.currency_code, so.exchange_rate, so.order_total, so.advance_paid, so.remaining_paid, so.credit_amount,
           so.remaining_due, so.payment_status, so.ledger_posting_status, so.created_at
    FROM sales_orders so
    LEFT JOIN countries c ON c.id = so.country_id
    LEFT JOIN country_branches cb ON cb.id = so.country_branch_id
    WHERE so.deleted_at IS NULL
    ORDER BY so.created_at DESC
    LIMIT 15;
  `;
  console.log("\n--- EXISTING SALES ORDERS (Latest 15) ---");
  console.table(sos);

  // 4. Exchange Rates
  const rates = await sql`
    SELECT id, from_currency_code, to_currency_code, rate, inverse_rate, effective_date, is_active, country_id
    FROM exchange_rates
    WHERE deleted_at IS NULL
    ORDER BY effective_date DESC, created_at DESC
    LIMIT 15;
  `;
  console.log("\n--- EXCHANGE RATES (Latest 15) ---");
  console.table(rates);

  // 5. Ledgers by Country/Branch
  const ledgers = await sql`
    SELECT l.id, l.account_code, l.account_name, l.nature, c.name as country, cb.name as branch, l.current_balance
    FROM ledgers l
    LEFT JOIN countries c ON c.id = l.country_id
    LEFT JOIN country_branches cb ON cb.id = l.country_branch_id
    WHERE l.deleted_at IS NULL
    ORDER BY c.name, l.account_name
    LIMIT 25;
  `;
  console.log("\n--- SAMPLE LEDGERS ---");
  console.table(ledgers);

  // 6. Check columns of ledgers and roznamcha
  const ledgerCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'ledgers'
    ORDER BY ordinal_position;
  `;
  console.log("\n--- LEDGER COLUMNS ---");
  console.log(ledgerCols.map(c => `${c.column_name} (${c.data_type})`).join(', '));

  const roznamchaCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'roznamcha_entries'
    ORDER BY ordinal_position;
  `;
  console.log("\n--- ROZNAMCHA COLUMNS ---");
  console.log(roznamchaCols.map(c => `${c.column_name} (${c.data_type})`).join(', '));

  // 7. Check RPCs and functions related to payments
  const rpcs = await sql`
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND (routine_name LIKE '%payment%' OR routine_name LIKE '%roznamcha%' OR routine_name LIKE '%purchase%' OR routine_name LIKE '%sale%')
    ORDER BY routine_name;
  `;
  console.log("\n--- PAYMENT / ROZNAMCHA / PURCHASE / SALE FUNCTIONS ---");
  console.log(rpcs.map(r => r.routine_name));

  await sql.end();
}

main().catch(err => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});
