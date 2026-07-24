import postgres from 'postgres';
import fs from 'fs';

const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(dbUrl);

async function main() {
  try {
    console.log("Checking if purchase_order_items exists...");
    const check = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'purchase_order_items'
      );
    `;
    console.log("Exists:", check[0].exists);

    if (!check[0].exists) {
      console.log("Applying 0045_multi_currency_accounting.sql...");
      const sqlContent = fs.readFileSync("supabase/migrations/0045_multi_currency_accounting.sql", "utf-8");
      await sql.unsafe(sqlContent);
      console.log("Applied migration 0045 successfully!");
    } else {
      console.log("Table purchase_order_items already exists.");
    }

    console.log("Reloading PostgREST schema cache...");
    await sql`NOTIFY pgrst, 'reload schema'`;
    console.log("Schema reloaded successfully!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

main();
