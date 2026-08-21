import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  const pos = await sql`
    SELECT po.id, po.purchase_order_no, po.country_id, c.name as country_name,
           po.order_total, po.advance_paid, po.remaining_paid, po.credit_amount, po.remaining_due,
           po.currency_code, po.exchange_rate, po.payment_status
    FROM purchase_orders po
    JOIN countries c ON c.id = po.country_id
    WHERE po.deleted_at IS NULL
    ORDER BY c.name, po.created_at DESC;
  `;
  console.log("=== PURCHASE ORDERS WITH COUNTRY ===");
  console.table(pos);

  const sos = await sql`
    SELECT so.id, so.sales_order_no, so.country_id, c.name as country_name,
           so.order_total, so.paid_amount, so.remaining_amount,
           so.currency_code, so.exchange_rate, so.payment_status
    FROM sales_orders so
    JOIN countries c ON c.id = so.country_id
    WHERE so.deleted_at IS NULL
    ORDER BY c.name, so.created_at DESC;
  `;
  console.log("=== SALES ORDERS WITH COUNTRY ===");
  console.table(sos);

  await sql.end();
}

main().catch(console.error);
