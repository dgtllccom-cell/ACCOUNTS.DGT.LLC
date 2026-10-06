import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => line.split("=").map((p) => p.trim()))
);

const dbUrl = env.POSTGRES_URL || env.DATABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const sql = postgres(dbUrl, { ssl: "require" });

async function checkRecords() {
  try {
    const orders = await sql`SELECT id, purchase_order_no, country_id, created_at FROM purchase_orders ORDER BY created_at DESC LIMIT 5`;
    console.log("purchase_orders:", orders);

    const items = await sql`SELECT * FROM purchase_order_items LIMIT 5`;
    console.log("purchase_order_items:", items);

    const goods = await sql`SELECT * FROM goods_entries LIMIT 5`;
    console.log("goods_entries:", goods);

  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

checkRecords();
