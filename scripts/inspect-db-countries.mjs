import postgres from "postgres";
import fs from "fs";

async function main() {
  let dbUrl = "";
  const envPath = fs.existsSync(".env.local") ? ".env.local" : (fs.existsSync("/var/www/dgt-nextjs/.env.local") ? "/var/www/dgt-nextjs/.env.local" : ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith("DATABASE_URL=")) {
        dbUrl = line.slice(line.indexOf("=") + 1).trim();
      }
    }
  }

  console.log("Connecting to:", dbUrl ? dbUrl.replace(/:[^:@]+@/, ":***@") : "NONE");
  const sql = postgres(dbUrl, { max: 1 });

  console.log("\n=== ALL COUNTRY ACCOUNTS ===");
  const cas = await sql`
    SELECT ca.id, ca.country_id, c.name as country_name, c.iso2, 
           lm.code as main_code, lm.name as main_name,
           li.code as inter_code, li.name as inter_name,
           lv.code as invest_code, lv.name as invest_name
    FROM public.country_accounts ca
    JOIN public.countries c ON c.id = ca.country_id
    LEFT JOIN public.ledgers lm ON lm.id = ca.main_account_ledger_id
    LEFT JOIN public.ledgers li ON li.id = ca.inter_country_ledger_id
    LEFT JOIN public.ledgers lv ON lv.id = ca.investment_ledger_id
    WHERE ca.deleted_at IS NULL;
  `;
  console.table(cas);

  console.log("\n=== TRIGGERS ON public.countries ===");
  const trigs = await sql`
    SELECT trigger_name, event_manipulation, action_statement, action_timing
    FROM information_schema.triggers
    WHERE event_object_table = 'countries';
  `;
  console.table(trigs);

  await sql.end();
}

main().catch(console.error);
