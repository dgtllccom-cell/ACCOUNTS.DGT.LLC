import fs from "node:fs";
import postgres from "postgres";

const envText = fs.readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });
const started = Date.now();

try {
  const [
    countries,
    countryBranches,
    cityBranches,
    users,
    assignments,
    enterpriseAccounts,
    companies,
    customers
  ] = await Promise.all([
    sql`
      select id, name, iso2, currency_code, official_email, admin_email, created_at
      from public.countries
      where deleted_at is null
    `,
    sql`
      select id, country_id, name, code, is_main, address, phone, email, whatsapp_number, owner_name, owner_customer_id, owner_profile_id, documents, contacts, created_at
      from public.country_branches
      where deleted_at is null
    `,
    sql`
      select id, country_id, country_branch_id, name, code, address, phone, email, owner_name, owner_customer_id, owner_profile_id, contacts, documents, created_at
      from public.city_branches
      where deleted_at is null
    `,
    sql`
      select id, full_name, preferred_language_code, created_at
      from public.profiles
      order by created_at desc
      limit 50
    `,
    sql`
      select user_id, role, country_id, country_branch_id, city_branch_id, is_active, created_at
      from public.user_role_assignments
      where deleted_at is null
    `,
    sql`
      select id, code, name, country_id, country_branch_id, city_branch_id, company_id, bank_id, customer_id, created_at
      from public.enterprise_accounts
      where deleted_at is null
      order by created_at desc
      limit 100
    `,
    sql`
      select id, company_name, registration_number, phone, email, address, country_id, city_id, created_at
      from public.companies
      where deleted_at is null
      order by created_at desc
      limit 50
    `,
    sql`
      select id, customer_name, country_id, phone, email, address, created_at
      from public.customers
      where deleted_at is null
      order by created_at desc
      limit 50
    `
  ]);

  console.log(JSON.stringify({
    elapsedMs: Date.now() - started,
    countries: countries.length,
    countryBranches: countryBranches.length,
    cityBranches: cityBranches.length,
    users: users.length,
    assignments: assignments.length,
    enterpriseAccounts: enterpriseAccounts.length,
    companies: companies.length,
    customers: customers.length
  }, null, 2));
} finally {
  await sql.end();
}
