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

async function main() {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `;
  const tableNames = tables.map(t => t.table_name);
  
  console.log("Purchase tables:", tableNames.filter(t => t.includes("purchas")));
  console.log("Roznamcha tables:", tableNames.filter(t => t.includes("rozn")));
  console.log("Ledger tables:", tableNames.filter(t => t.includes("ledger")));
  console.log("Shipping tables:", tableNames.filter(t => t.includes("ship") || t.includes("clear") || t.includes("order")));
  console.log("Goods tables:", tableNames.filter(t => t.includes("good")));
  console.log("App/setting tables:", tableNames.filter(t => t.includes("setting") || t.includes("app")));

  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
