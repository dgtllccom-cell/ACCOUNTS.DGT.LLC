import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

function readDbUrl() {
  const roots = [
    process.cwd(),
    path.join(process.cwd(), "ACCOUNTS.DGT.LLC"),
    path.resolve(process.cwd(), ".."),
  ];
  for (const root of roots) {
    for (const file of [".env.local", ".env"]) {
      const filePath = path.join(root, file);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, "utf8");
      const match = content.match(/^DATABASE_URL\s*=\s*(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return "";
}

const dbUrl = readDbUrl();
if (!dbUrl) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function timed(label, query) {
  const start = Date.now();
  try {
    const rows = await query();
    return {
      label,
      ms: Date.now() - start,
      count: Array.isArray(rows) ? rows.length : null,
    };
  } catch (error) {
    return {
      label,
      ms: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

try {
  const results = [];
  results.push(
    await timed("countries", () =>
      sql`select id, name, iso2, currency_code, official_email, admin_email, created_at from public.countries where deleted_at is null`
    )
  );
  results.push(
    await timed("country_branches", () =>
      sql`select id, country_id, name, code, is_main, address, phone, email, whatsapp_number, owner_name, owner_customer_id, owner_profile_id, documents, contacts, created_at from public.country_branches where deleted_at is null`
    )
  );
  results.push(
    await timed("city_branches", () =>
      sql`select id, country_id, country_branch_id, name, code, address, phone, email, owner_name, owner_customer_id, owner_profile_id, contacts, documents, created_at from public.city_branches where deleted_at is null`
    )
  );
  results.push(
    await timed("profiles", () =>
      sql`select id, full_name, preferred_language_code, created_at from public.profiles order by created_at desc limit 50`
    )
  );
  results.push(
    await timed("assignments", () =>
      sql`select user_id, role, country_id, country_branch_id, city_branch_id, is_active, created_at from public.user_role_assignments where deleted_at is null`
    )
  );
  results.push(
    await timed("enterprise_accounts", () =>
      sql`select id, code, name, country_id, country_branch_id, city_branch_id, company_id, bank_id, customer_id, created_at from public.enterprise_accounts where deleted_at is null order by created_at desc limit 100`
    )
  );
  results.push(
    await timed("companies", () =>
      sql`select id, name, legal_name, company_code, address, country_id, city_id, owner_name, contacts, created_at from public.companies where deleted_at is null order by created_at desc limit 50`
    )
  );
  results.push(
    await timed("customers", () =>
      sql`select id, customer_name, company_name, contact_person, mobile, whatsapp, email, address, country_id, created_at from public.customers where deleted_at is null order by created_at desc limit 50`
    )
  );

  console.log(JSON.stringify(results, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
