import fs from "fs";
import path from "path";
import postgres from "postgres";

function getDbUrl() {
  const envFile = fs.readFileSync(".env.local", "utf8");
  const match = envFile.match(/^DATABASE_URL\s*=\s*(.+)$/m);
  return match ? match[1].trim().replace(/^['"]|['"]$/g, "") : "";
}

async function main() {
  const dbUrl = getDbUrl();
  console.log("DB URL connected (DEV check):", dbUrl.includes("csesvyxxjivnkkozgopt"));
  const sql = postgres(dbUrl, { ssl: "require", prepare: false });

  try {
    const poCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'purchase_orders'
      ORDER BY ordinal_position;
    `;
    console.log("=== PURCHASE_ORDERS COLUMNS ===");
    console.log(poCols.map(c => `${c.column_name} (${c.data_type})`).join(", "));

    const lpCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'local_purchases'
      ORDER BY ordinal_position;
    `;
    console.log("\n=== LOCAL_PURCHASES COLUMNS ===");
    console.log(lpCols.map(c => `${c.column_name} (${c.data_type})`).join(", "));

    const soCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sales_orders'
      ORDER BY ordinal_position;
    `;
    console.log("\n=== SALES_ORDERS COLUMNS ===");
    console.log(soCols.map(c => `${c.column_name} (${c.data_type})`).join(", "));

    const popCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'purchase_order_payments'
      ORDER BY ordinal_position;
    `;
    console.log("\n=== PURCHASE_ORDER_PAYMENTS COLUMNS ===");
    console.log(popCols.map(c => `${c.column_name} (${c.data_type})`).join(", "));

    const sopCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sales_order_payments'
      ORDER BY ordinal_position;
    `;
    console.log("\n=== SALES_ORDER_PAYMENTS COLUMNS ===");
    console.log(sopCols.map(c => `${c.column_name} (${c.data_type})`).join(", "));

    const crmCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'crm_action_items'
      ORDER BY ordinal_position;
    `;
    console.log("\n=== CRM_ACTION_ITEMS COLUMNS ===");
    console.log(crmCols.map(c => `${c.column_name} (${c.data_type})`).join(", "));

    // Check sample rows from purchase_orders, local_purchases, sales_orders
    const samplePo = await sql`SELECT id, purchase_order_no, order_date, created_at, form_data FROM purchase_orders LIMIT 1`;
    console.log("\n=== SAMPLE PO ===", samplePo[0]?.purchase_order_no, Object.keys(samplePo[0]?.form_data || {}));
    if (samplePo[0]?.form_data) {
      console.log("PO form_data.form keys:", Object.keys(samplePo[0]?.form_data?.form || {}));
      console.log("PO dates in form:", {
        orderDate: samplePo[0]?.form_data?.form?.orderDate,
        dueDate: samplePo[0]?.form_data?.form?.dueDate,
        paymentDueDate: samplePo[0]?.form_data?.form?.paymentDueDate,
        advDueDate: samplePo[0]?.form_data?.form?.advDueDate,
        remainingDueDate: samplePo[0]?.form_data?.form?.remainingDueDate
      });
    }

    const sampleLp = await sql`SELECT id, manual_bill_no, bill_date, due_date, adv_payment_due_date, remaining_payment_due_date FROM local_purchases WHERE due_date IS NOT NULL OR adv_payment_due_date IS NOT NULL OR remaining_payment_due_date IS NOT NULL LIMIT 1`;
    console.log("\n=== SAMPLE LP ===", sampleLp);

    const sampleSo = await sql`SELECT id, sales_order_no, order_date, form_data FROM sales_orders LIMIT 1`;
    console.log("\n=== SAMPLE SO ===", sampleSo[0]?.sales_order_no, Object.keys(sampleSo[0]?.form_data || {}));
    if (sampleSo[0]?.form_data) {
      console.log("SO form_data.form keys:", Object.keys(sampleSo[0]?.form_data?.form || {}));
      console.log("SO dates in form:", {
        orderDate: sampleSo[0]?.form_data?.form?.orderDate,
        dueDate: sampleSo[0]?.form_data?.form?.dueDate,
        paymentDueDate: sampleSo[0]?.form_data?.form?.paymentDueDate,
        advDueDate: sampleSo[0]?.form_data?.form?.advDueDate,
        remainingDueDate: sampleSo[0]?.form_data?.form?.remainingDueDate
      });
    }

  } finally {
    await sql.end();
  }
}

main().catch(console.error);
