import fs from "fs";
import postgres from "postgres";

let envContent = "";
if (fs.existsSync(".env.local")) envContent += "\n" + fs.readFileSync(".env.local", "utf8");
if (fs.existsSync(".env")) envContent += "\n" + fs.readFileSync(".env", "utf8");

let dbUrl = "";
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    dbUrl = trimmed.replace("DATABASE_URL=", "").replace(/^["']/, "").replace(/["']$/, "");
  }
}

const sql = postgres(dbUrl);

async function runSqlFile(path) {
  console.log(`Running migration: ${path}`);
  const content = fs.readFileSync(path, "utf8");
  await sql.unsafe(content);
  console.log(`✅ Success: ${path}`);
}

async function main() {
  const migrations = [
    "supabase/migrations/20260813_clearing_customer_orders.sql",
    "supabase/migrations/20260817_extend_clearing_customer_orders.sql",
    "supabase/migrations/20260817_extend_clearing_customer_orders_goods.sql"
  ];

  for (const m of migrations) {
    if (fs.existsSync(m)) {
      await runSqlFile(m);
    }
  }

  await sql`NOTIFY pgrst, 'reload schema'`;
  console.log("✅ All clearing customer orders migrations executed and schema reloaded!");
  process.exit(0);
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
