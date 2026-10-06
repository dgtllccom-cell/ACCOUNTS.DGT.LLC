import postgres from "postgres";
import fs from "fs";

async function main() {
  const envPath = fs.existsSync("/var/www/dgt-nextjs/.env.local")
    ? "/var/www/dgt-nextjs/.env.local"
    : ".env.local";

  const envContent = fs.readFileSync(envPath, "utf8");
  const dbUrl = envContent
    .split("\n")
    .find(line => line.startsWith("DATABASE_URL="))
    ?.split("=")[1]
    ?.trim();

  const sql = postgres(dbUrl, { max: 1 });

  console.log("Checking duplicate country 9659e261-ae04-4227-b2e5-f4e20ddcb460...");
  const [targetCountry] = await sql`
    SELECT * FROM public.countries WHERE id = '9659e261-ae04-4227-b2e5-f4e20ddcb460';
  `;
  console.log("Target country row:", targetCountry);

  if (targetCountry) {
    // Soft delete / close country_accounts
    await sql`
      UPDATE public.country_accounts 
      SET deleted_at = NOW(), status = 'closed', updated_at = NOW() 
      WHERE country_id = '9659e261-ae04-4227-b2e5-f4e20ddcb460';
    `;
    console.log("✔ Closed country_accounts for target country");

    // Soft delete ledgers
    await sql`
      UPDATE public.ledgers 
      SET deleted_at = NOW(), is_active = false, updated_at = NOW() 
      WHERE country_id = '9659e261-ae04-4227-b2e5-f4e20ddcb460';
    `;
    console.log("✔ Deactivated ledgers for target country");

    // Check if countries has deleted_at
    const cols = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'countries' AND column_name = 'deleted_at';
    `;
    if (cols.length > 0) {
      await sql`
        UPDATE public.countries 
        SET deleted_at = NOW(), is_active = false, updated_at = NOW() 
        WHERE id = '9659e261-ae04-4227-b2e5-f4e20ddcb460';
      `;
    } else {
      await sql`
        UPDATE public.countries 
        SET is_active = false, updated_at = NOW() 
        WHERE id = '9659e261-ae04-4227-b2e5-f4e20ddcb460';
      `;
    }
    console.log("✔ Deactivated target country in public.countries");
  }

  await sql.end();
}

main().catch(console.error);
