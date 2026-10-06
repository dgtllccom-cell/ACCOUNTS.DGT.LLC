import postgres from 'postgres';
import fs from 'fs';

let dbUrl = '';
if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      dbUrl = line.trim().substring('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

const sql = postgres(dbUrl);

async function main() {
  const afg = await sql`
    SELECT c.id, c.customer_name, c.first_name, c.last_name, c.person_code, c.country_id, co.name as country_name, c.city_id, ci.name as city_name, c.is_active
    FROM public.customers c
    JOIN public.countries co ON co.id = c.country_id
    LEFT JOIN public.cities ci ON ci.id = c.city_id
    WHERE co.name ILIKE '%Afghanistan%'
  `;
  console.log('TOTAL AFGHANISTAN CUSTOMERS IN DB:', afg.length);
  for (const c of afg) {
    console.log(`- ID: ${c.id} | Code: ${c.person_code} | Name: "${c.customer_name}" | First: "${c.first_name}" | Last: "${c.last_name}" | City: "${c.city_name}" | Active: ${c.is_active}`);
  }

  const allCust = await sql`
    SELECT count(*)::int as total
    FROM public.customers
  `;
  console.log('TOTAL ALL CUSTOMERS IN DB:', allCust[0].total);

  const allEmp = await sql`
    SELECT count(*)::int as total
    FROM public.employees
  `;
  console.log('TOTAL EMPLOYEES IN DB:', allEmp[0].total);

  await sql.end();
}

main().catch(console.error);
