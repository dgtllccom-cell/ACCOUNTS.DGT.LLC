import fs from "node:fs";
import postgres from "postgres";

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });

async function main() {
  try {
    const rows = await sql`
      SELECT id, purchase_order_id, sales_order_no, order_total, paid_amount, remaining_amount 
      FROM sales_orders 
      WHERE purchase_order_id IS NOT NULL 
      LIMIT 10
    `;
    console.log("Sales orders with purchase_order_id:");
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

main();
