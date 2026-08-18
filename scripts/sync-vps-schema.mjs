import fs from "fs";
import postgres from "postgres";

const VPS_DB_URL = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

const sql = postgres(VPS_DB_URL);

async function main() {
  console.log("Connecting directly to VPS Production DB (inmayhrxucimxqhgseqi)...");
  
  // 1. Ensure app_settings
  console.log("1. Ensuring app_settings table...");
  await sql`
    CREATE TABLE IF NOT EXISTS public.app_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      setting_key text UNIQUE NOT NULL,
      setting_value text,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    )
  `;

  // 2. Ensure clearing_customer_orders and clearing_customer_order_parties
  console.log("2. Ensuring clearing customer orders tables and columns...");
  const migrations = [
    "supabase/migrations/20260813_clearing_customer_orders.sql",
    "supabase/migrations/20260817_extend_clearing_customer_orders.sql",
    "supabase/migrations/20260817_extend_clearing_customer_orders_goods.sql"
  ];

  for (const m of migrations) {
    if (fs.existsSync(m)) {
      console.log(`Running migration: ${m}`);
      const content = fs.readFileSync(m, "utf8");
      await sql.unsafe(content);
      console.log(`✓ Applied ${m}`);
    }
  }

  // 3. Reload schema cache
  console.log("3. Reloading PostgREST schema cache on VPS DB...");
  await sql`NOTIFY pgrst, 'reload schema'`;
  
  console.log("✅ All migrations applied to VPS production database!");
  process.exit(0);
}

main().catch(err => {
  console.error("Migration error on VPS DB:", err);
  process.exit(1);
});
