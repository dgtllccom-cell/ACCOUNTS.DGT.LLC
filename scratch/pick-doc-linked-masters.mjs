import fs from 'node:fs';
import postgres from 'postgres';
function readDbUrl() { if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim(); for (const f of ['.env.local','.env']) { if (fs.existsSync(f)) { const c = fs.readFileSync(f,'utf8'); const m = c.match(/^DATABASE_URL\s*=\s*(.+)$/m); if (m) return m[1].trim().replace(/^['"]|['"]$/g,''); } } throw new Error('DATABASE_URL not found'); }
const sql = postgres(readDbUrl(), { max: 1, prepare: false });
try {
  const company = await sql`select id, company_code, name, country_id, country_branch_id, city_branch_id from public.companies where deleted_at is null order by created_at asc limit 1`;
  const account = await sql`select id, account_number, code, name, country_id, country_branch_id, city_branch_id from public.enterprise_accounts where deleted_at is null order by created_at asc limit 1`;
  const customer = await sql`select id, person_code, customer_name, first_name, last_name, country_id, district_id, city_id from public.customers where deleted_at is null order by created_at asc limit 1`;
  const employee = await sql`select id, employee_code, category, designation, department, country_id, country_branch_id, city_branch_id from public.employees where deleted_at is null order by created_at asc limit 1`;
  console.log(JSON.stringify({company: company[0] ?? null, account: account[0] ?? null, customer: customer[0] ?? null, employee: employee[0] ?? null}, null, 2));
} finally { await sql.end({ timeout: 5 }); }
