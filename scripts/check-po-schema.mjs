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
    const poCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'purchase_orders'
      ORDER BY ordinal_position;
    `;
    console.log("=== PURCHASE_ORDERS COLUMNS ===");
    for (const c of poCols) {
      console.log(`${c.column_name}: ${c.data_type}`);
    }

    const samplePo = await sql`SELECT id, purchase_order_no, created_at, form_data FROM purchase_orders LIMIT 1`;
    console.log("\n=== SAMPLE PO FORM DATA ===");
    if (samplePo[0]) {
      console.log("form_data keys:", Object.keys(samplePo[0].form_data || {}));
      console.log("form_data.form:", samplePo[0].form_data?.form);
    }

    const sampleLp = await sql`SELECT id, manual_bill_no, created_at, line_items, extra_charges, loading_details FROM local_purchases LIMIT 1`;
    console.log("\n=== SAMPLE LP ===");
    if (sampleLp[0]) {
      console.log("manual_bill_no:", sampleLp[0].manual_bill_no);
      console.log("loading_details:", sampleLp[0].loading_details);
    }
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
