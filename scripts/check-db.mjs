import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPaths = ['.env.local', '.env.production', '.env'];
  for (const envFile of envPaths) {
    const fullPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const match = content.match(/^DATABASE_URL=(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

async function main() {
  const dbUrl = getDbUrl();
  console.log("DB URL exists:", !!dbUrl);
  if (!dbUrl) return;
  const sql = postgres(dbUrl, { max: 1 });
  
  const countries = await sql`select id, name, iso2, iso3, currency_code from countries order by name`;
  console.log("Countries:", countries);

  const branches = await sql`select id, name, code, country_id from city_branches limit 10`;
  console.log("Branches:", branches);

  const pos = await sql`select id, purchase_order_no, payment_status, advance_paid, remaining_due, created_at from purchase_orders order by created_at desc limit 5`;
  console.log("Existing POs:", pos);

  await sql.end();
}

main().catch(console.error);
