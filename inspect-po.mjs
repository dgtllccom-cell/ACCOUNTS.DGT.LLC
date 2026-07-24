import postgres from 'postgres';

const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(dbUrl);

async function inspect() {
  const [po] = await sql`
    SELECT * 
    FROM purchase_orders 
    WHERE purchase_order_no = 'PO-1784130962095'
  `;
  
  if (!po) {
    console.log("Purchase order PO-1784130962095 not found.");
    process.exit(1);
  }
  
  console.log("Purchase Order fields:");
  console.log(`ID: ${po.id}`);
  console.log(`PO No: ${po.purchase_order_no}`);
  console.log(`Country: ${po.country_id}`);
  console.log(`Branch: ${po.city_branch_id}`);
  console.log(`Currency: ${po.currency_code}`);
  console.log(`Exchange Rate: ${po.exchange_rate}`);
  console.log(`Order Total: ${po.order_total}`);
  console.log("\nForm data contents:");
  console.log(JSON.stringify(po.form_data, null, 2));
  
  process.exit(0);
}

inspect().catch(console.error);
