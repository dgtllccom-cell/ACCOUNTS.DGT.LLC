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

try {
  const payments = await sql`
    SELECT p.id, p.purchase_order_id, p.amount, p.currency_code, p.exchange_rate, o.purchase_order_no, o.currency_code as po_currency, o.exchange_rate as po_exchange_rate, o.advance_paid, o.remaining_due
    FROM purchase_order_payments p
    JOIN purchase_orders o ON p.purchase_order_id = o.id
    WHERE p.deleted_at IS NULL
  `;
  console.log("Active Purchase Payments in DB:");
  console.table(payments);
} catch (e) {
  console.error(e);
} finally {
  await sql.end();
}
