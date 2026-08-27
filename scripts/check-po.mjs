import postgres from "postgres";

const dbUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:54322/postgres";
const sql = postgres(dbUrl);

async function main() {
  try {
    const orders = await sql`
      select id, purchase_order_no, purchase_contract_no, currency_code, payment_currency, exchange_rate, order_total, ledger_posting_status, created_at 
      from purchase_orders 
      order by created_at desc 
      limit 10
    `;
    console.log("Recent Purchase Orders in DB:", JSON.stringify(orders, null, 2));

    const specific = await sql`
      select id, purchase_order_no, purchase_contract_no, currency_code, payment_currency, exchange_rate, order_total, ledger_posting_status, form_data
      from purchase_orders
      where purchase_order_no ILIKE '%PO-DXB-25087%' or purchase_contract_no ILIKE '%DSA-25087%'
      limit 5
    `;
    console.log("Specific Order PO-DXB-25087:", JSON.stringify(specific, null, 2));
  } catch (err) {
    console.error("Error checking DB:", err);
  } finally {
    await sql.end();
  }
}

main();
