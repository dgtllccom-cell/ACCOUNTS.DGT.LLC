import postgres from 'postgres';

const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(dbUrl);

async function checkOrder() {
  console.log("Fetching the 5 most recent purchase orders...");
  
  const orders = await sql`
    SELECT id, purchase_order_no, purchase_contract_no, ledger_posting_status, payment_status, form_data->'workflow'->>'transferStatus' as transfer_status, advance_paid, remaining_due, order_total 
    FROM purchase_orders 
    ORDER BY created_at DESC
    LIMIT 5
  `;
  
  if (orders.length === 0) {
    console.log("No orders found in database.");
    process.exit(1);
  }
  
  console.log(`Found ${orders.length} recent orders:\n`);
  
  for (const row of orders) {
    console.log(`--- PO: ${row.purchase_order_no} | Contract: ${row.purchase_contract_no || "N/A"} ---`);
    console.log(`Ledger Posting Status: ${row.ledger_posting_status}`);
    console.log(`Payment Status: ${row.payment_status}`);
    console.log(`Transfer Status (Workflow): ${row.transfer_status || "N/A"}`);
    console.log(`Advance Paid: ${row.advance_paid}`);
    console.log(`Order Total: ${row.order_total}`);
    console.log("------------------------------------------");
  }

  process.exit(0);
}

checkOrder().catch(console.error);
