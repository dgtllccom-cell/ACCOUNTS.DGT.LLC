import fs from "fs";
import postgres from "postgres";

function getDbUrl() {
  const envFile = fs.readFileSync(".env.local", "utf8");
  const match = envFile.match(/^DATABASE_URL\s*=\s*(.+)$/m);
  return match ? match[1].trim().replace(/^['"]|['"]$/g, "") : "";
}

async function main() {
  const sql = postgres(getDbUrl(), { ssl: "require", prepare: false });
  try {
    const poCount = await sql`SELECT count(*) FROM purchase_orders WHERE deleted_at IS NULL`;
    const lpCount = await sql`SELECT count(*) FROM local_purchases WHERE deleted_at IS NULL`;
    const soCount = await sql`SELECT count(*) FROM sales_orders WHERE deleted_at IS NULL`;
    const popCount = await sql`SELECT count(*) FROM purchase_order_payments WHERE deleted_at IS NULL`;
    const sopCount = await sql`SELECT count(*) FROM sales_order_payments WHERE deleted_at IS NULL`;

    console.log("DEV Counts:", {
      purchaseOrders: poCount[0].count,
      localPurchases: lpCount[0].count,
      salesOrders: soCount[0].count,
      purchasePayments: popCount[0].count,
      salesPayments: sopCount[0].count
    });

    // Check payment conditions / types in purchase_orders
    const poTypes = await sql`
      SELECT 
        coalesce(form_data->'form'->>'paymentType', form_data->'form'->>'paymentCondition', 'Unknown') as p_type,
        count(*)
      FROM purchase_orders 
      WHERE deleted_at IS NULL 
      GROUP BY p_type;
    `;
    console.log("PO payment types:", poTypes);

    // Check payment conditions / types in sales_orders
    const soTypes = await sql`
      SELECT 
        coalesce(form_data->'form'->>'paymentType', form_data->'form'->>'paymentCondition', 'Unknown') as s_type,
        count(*)
      FROM sales_orders 
      WHERE deleted_at IS NULL 
      GROUP BY s_type;
    `;
    console.log("SO payment types:", soTypes);

    // Sample due dates from POs and SOs
    const samplePoDates = await sql`
      SELECT 
        purchase_order_no,
        order_total,
        advance_paid,
        remaining_due,
        currency_code,
        form_data->'form'->>'supplierName' as supplier_name,
        form_data->'form'->>'dueDate' as due_date,
        form_data->'form'->>'paymentDueDate' as payment_due_date,
        form_data->'form'->>'advDueDate' as adv_due_date,
        form_data->'form'->>'remainingDueDate' as remaining_due_date
      FROM purchase_orders
      WHERE deleted_at IS NULL
      LIMIT 5;
    `;
    console.log("Sample PO Dates:", samplePoDates);

    const sampleSoDates = await sql`
      SELECT 
        sales_order_no,
        order_total,
        paid_amount,
        remaining_amount,
        currency_code,
        customer_name,
        form_data->'form'->>'dueDate' as due_date,
        form_data->'form'->>'paymentDueDate' as payment_due_date,
        form_data->'form'->>'advDueDate' as adv_due_date,
        form_data->'form'->>'remainingDueDate' as remaining_due_date
      FROM sales_orders
      WHERE deleted_at IS NULL
      LIMIT 5;
    `;
    console.log("Sample SO Dates:", sampleSoDates);

  } finally {
    await sql.end();
  }
}

main().catch(console.error);
