import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  const pos = await sql`
    SELECT po.id, po.purchase_order_no, po.purchase_contract_no, c.name as country_name, cb.name as branch_name,
           po.order_total, po.advance_paid, po.remaining_paid, po.credit_amount, po.remaining_due, po.payment_status,
           po.currency_code, po.exchange_rate, po.form_data->'form'->>'supplierName' as supplier,
           po.form_data->'form'->>'totalAmount' as form_total,
           po.form_data->'form'->>'advancePercent' as adv_pct
    FROM purchase_orders po
    LEFT JOIN countries c ON c.id = po.country_id
    LEFT JOIN country_branches cb ON cb.id = po.country_branch_id
    WHERE po.deleted_at IS NULL
    ORDER BY po.order_total DESC;
  `;
  console.log("=== ALL PURCHASE ORDERS ===");
  console.table(pos);

  const sos = await sql`
    SELECT so.id, so.sales_order_no, so.sales_contract_no, c.name as country_name, cb.name as branch_name,
           so.order_total, so.paid_amount, so.remaining_amount, so.payment_status,
           so.currency_code, so.exchange_rate, so.customer_name,
           so.form_data->'form'->>'totalAmount' as form_total,
           so.form_data->'form'->>'advancePercent' as adv_pct
    FROM sales_orders so
    LEFT JOIN countries c ON c.id = so.country_id
    LEFT JOIN country_branches cb ON cb.id = so.country_branch_id
    WHERE so.deleted_at IS NULL
    ORDER BY so.order_total DESC;
  `;
  console.log("=== ALL SALES ORDERS ===");
  console.table(sos);

  const countries = await sql`
    SELECT id, name, currency_code FROM countries WHERE deleted_at IS NULL;
  `;
  console.log("=== ALL COUNTRIES ===");
  console.table(countries);

  const branches = await sql`
    SELECT cb.id, cb.country_id, c.name as country_name, cb.name as branch_name, cb.code 
    FROM country_branches cb
    JOIN countries c ON c.id = cb.country_id
    WHERE cb.deleted_at IS NULL;
  `;
  console.log("=== ALL BRANCHES ===");
  console.table(branches);

  const ledgers = await sql`
    SELECT l.id, l.code, l.name, l.currency, l.current_balance, c.name as country_name, cb.name as branch_name
    FROM ledgers l
    LEFT JOIN countries c ON c.id = l.country_id
    LEFT JOIN country_branches cb ON cb.id = l.country_branch_id
    WHERE l.deleted_at IS NULL
    ORDER BY c.name, l.name;
  `;
  console.log("=== ALL LEDGERS ===");
  console.table(ledgers);

  await sql.end();
}

main().catch(console.error);
