import fs from 'node:fs';
import postgres from 'postgres';
function readDbUrl() { if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim(); for (const f of ['.env.local','.env']) { if (fs.existsSync(f)) { const c = fs.readFileSync(f,'utf8'); const m = c.match(/^DATABASE_URL\s*=\s*(.+)$/m); if (m) return m[1].trim().replace(/^['"]|['"]$/g,''); } } throw new Error('DATABASE_URL not found'); }
const sql = postgres(readDbUrl(), { max: 1, prepare: false });
try {
  const country = await sql`select id, name, iso2 from public.countries where iso2 = 'AE' limit 1`;
  const mainBranch = await sql`select id, name, code from public.country_branches where country_id = ${country[0].id} and deleted_at is null order by is_main desc, created_at asc limit 1`;
  const cityBranch = await sql`select id, city_name, name, code from public.city_branches where country_id = ${country[0].id} and deleted_at is null order by created_at asc limit 1`;
  const company = await sql`select id, company_code, name from public.companies where country_id = ${country[0].id} and deleted_at is null order by created_at asc limit 1`;
  const account = await sql`select id, account_number, code, name from public.enterprise_accounts where country_id = ${country[0].id} and deleted_at is null order by created_at asc limit 1`;
  const customer = await sql`select id, person_code, customer_name, first_name, last_name from public.customers where country_id = ${country[0].id} and deleted_at is null order by created_at asc limit 1`;
  const employee = await sql`select id, employee_code, designation, department from public.employees where country_id = ${country[0].id} and deleted_at is null order by created_at asc limit 1`;
  console.log(JSON.stringify({country: country[0], mainBranch: mainBranch[0] ?? null, cityBranch: cityBranch[0] ?? null, company: company[0] ?? null, account: account[0] ?? null, customer: customer[0] ?? null, employee: employee[0] ?? null}, null, 2));
} finally { await sql.end({ timeout: 5 }); }
