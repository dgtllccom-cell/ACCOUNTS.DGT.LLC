import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  const countries = await sql`
    SELECT c.id, c.name, c.iso2, c.currency_code, c.reporting_currency
    FROM countries c
    WHERE c.deleted_at IS NULL;
  `;
  console.log("=== COUNTRIES ===");
  console.table(countries);

  const branches = await sql`
    SELECT cb.id, cb.country_id, c.name as country_name, cb.name as branch_name, cb.code, cb.local_currency, cb.is_main
    FROM country_branches cb
    JOIN countries c ON c.id = cb.country_id
    WHERE cb.deleted_at IS NULL
    ORDER BY c.name, cb.name;
  `;
  console.log("=== BRANCHES ===");
  console.table(branches);

  const activePos = await sql`
    SELECT po.id, po.purchase_order_no, po.purchase_contract_no, po.country_id, c.name as country_name,
           po.country_branch_id, cb.name as branch_name, po.city_branch_id,
           po.currency_code, po.exchange_rate, po.order_total, po.advance_paid, po.remaining_paid, po.credit_amount,
           po.remaining_due, po.payment_status, po.ledger_posting_status
    FROM purchase_orders po
    LEFT JOIN countries c ON c.id = po.country_id
    LEFT JOIN country_branches cb ON cb.id = po.country_branch_id
    WHERE po.deleted_at IS NULL
    ORDER BY po.order_total DESC, po.created_at DESC
    LIMIT 30;
  `;
  console.log("=== PURCHASE ORDERS WITH TOTALS ===");
  console.table(activePos);

  const activeSos = await sql`
    SELECT so.id, so.sales_order_no, so.sales_contract_no, so.country_id, c.name as country_name,
           so.country_branch_id, cb.name as branch_name, so.city_branch_id,
           so.currency_code, so.exchange_rate, so.order_total, so.paid_amount,
           so.remaining_amount, so.payment_status, so.ledger_posting_status
    FROM sales_orders so
    LEFT JOIN countries c ON c.id = so.country_id
    LEFT JOIN country_branches cb ON cb.id = so.country_branch_id
    WHERE so.deleted_at IS NULL
    ORDER BY so.order_total DESC, so.created_at DESC
    LIMIT 30;
  `;
  console.log("=== SALES ORDERS WITH TOTALS ===");
  console.table(activeSos);

  await sql.end();
}

main().catch(console.error);
