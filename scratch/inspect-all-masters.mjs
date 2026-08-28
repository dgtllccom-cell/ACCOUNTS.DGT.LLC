
import postgres from "postgres";
import fs from "fs";

const envLines = fs.readFileSync('.env.local', 'utf8').split('\n');
let dbUrl = '';
for (const line of envLines) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
    break;
  }
}

async function run() {
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    console.log("=== INSPECTING MASTER ENTITIES ===");

    const countries = await sql`SELECT id, name, iso2 FROM public.countries ORDER BY name ASC;`;
    console.log("Countries:", countries.map(c => `${c.name} (${c.iso2 || ''}): ${c.id}`));

    const branches = await sql`SELECT id, name, code, country_id FROM public.country_branches;`;
    console.log("Country Branches:", branches.map(b => `${b.name} (${b.code}): ${b.id} [Country: ${b.country_id}]`));

    const cityBranches = await sql`SELECT id, name, code, city_name, country_branch_id FROM public.city_branches;`;
    console.log("City Branches:", cityBranches.map(cb => `${cb.name} (${cb.code}) - ${cb.city_name}: ${cb.id}`));

    const companies = await sql`SELECT id, name, country_id FROM public.companies LIMIT 20;`;
    console.log("Companies:", companies.map(c => `${c.name}: ${c.id}`));

    const accounts = await sql`SELECT id, account_code, account_name, currency, country_id FROM public.accounts LIMIT 30;`;
    console.log("Accounts:", accounts.map(a => `${a.account_code} - ${a.account_name} (${a.currency}): ${a.id}`));

    const products = await sql`
      SELECT p.id, p.product_code, p.product_name, p.hs_code, p.size, pc.category_name 
      FROM public.products p
      LEFT JOIN public.product_categories pc ON pc.id = p.category_id
      ORDER BY p.product_code ASC;
    `;
    console.log(`Products (${products.length}):`, products.map(p => `${p.product_code}: ${p.product_name} [${p.category_name || ''}]`));
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
run();
