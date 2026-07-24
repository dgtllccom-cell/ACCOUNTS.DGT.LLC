import fs from "node:fs";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });
const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const countryAdminPermissions = [
  "companies:read",
  "business_groups:read",
  "country_company_profiles:read",
  "countries:read",
  "country_branches:create",
  "country_branches:read",
  "country_branches:update",
  "city_branches:create",
  "city_branches:read",
  "city_branches:update",
  "users:create",
  "users:read",
  "users:update",
  "users:delete",
  "customers:create",
  "customers:read",
  "customers:update",
  "suppliers:create",
  "suppliers:read",
  "suppliers:update",
  "accounts:create",
  "accounts:read",
  "accounts:update",
  "ledgers:create",
  "ledgers:read",
  "ledgers:update",
  "journal_entries:create",
  "journal_entries:read",
  "journal_entries:post",
  "roznamcha:create",
  "roznamcha:read",
  "roznamcha:post",
  "transactions:create",
  "transactions:read",
  "purchases:create",
  "purchases:read",
  "purchases:update",
  "purchases:post",
  "sales:create",
  "sales:read",
  "sales:update",
  "sales:post",
  "products:create",
  "products:read",
  "products:update",
  "inventory:read",
  "warehouses:create",
  "warehouses:read",
  "warehouses:update",
  "banks:create",
  "banks:read",
  "banks:update",
  "reports:read",
  "reports:export",
  "messages:create",
  "messages:read",
  "email_management:create",
  "email_management:read",
  "currency_rates:create",
  "currency_rates:read",
  "currency_rates:update",
  "approvals:create",
  "approvals:read",
  "approvals:approve"
];

const countryStandardPermissionGroups = [
  "dashboard.access",
  "branch.new_entry",
  "branch.all",
  "branch.city",
  "branch.general_report",
  "users.access",
  "users.create",
  "users.edit",
  "users.view",
  "accounts.new_entry",
  "accounts.master",
  "accounts.reports",
  "ledgers.general",
  "ledgers.reports",
  "journal.daily_payment.purchase_payment",
  "journal.daily_payment.add_new",
  "journal.daily_payment.remaining_credit",
  "journal.daily_payment.voucher",
  "journal.roznamcha.general",
  "journal.roznamcha.daily_report",
  "journal.roznamcha.cash_entry",
  "shipping.line_master",
  "shipping.processing",
  "clearing.agent_master",
  "clearing.processing",
  "purchase.entry",
  "purchase.orders",
  "purchase.reports",
  "sales.entry",
  "sales.orders",
  "sales.reports",
  "reports.management.financial_summary",
  "reports.management.branch_analysis",
  "reports.management.dashboard",
  "reports.roznamcha.country",
  "reports.roznamcha.city",
  "reports.roznamcha.bulk",
  "reports.ledger.general",
  "reports.purchase.summary",
  "reports.purchase.supplier",
  "reports.sales.summary",
  "reports.sales.customer",
  "messages.inbox",
  "messages.sent",
  "messages.notifications",
  "messages.email_management",
  "settings.user_permissions",
  "settings.currency"
];

const countrySetups = [
  {
    countryName: "United Arab Emirates",
    iso2: "AE",
    iso3: "ARE",
    currency: "AED",
    branchName: "UAE / Dubai Main Branch",
    branchCode: "UAE-MAIN",
    adminUserCode: "ARE-CA-000001"
  },
  {
    countryName: "India",
    iso2: "IN",
    iso3: "IND",
    currency: "INR",
    branchName: "India Main Branch",
    branchCode: "IND-MAIN",
    adminUserCode: "IND-CA-000001"
  },
  {
    countryName: "Iran",
    iso2: "IR",
    iso3: "IRN",
    currency: "IRR",
    branchName: "Iran Main Branch",
    branchCode: "IRN-MAIN",
    adminUserCode: "IRN-CA-000001"
  },
  {
    countryName: "Pakistan",
    iso2: "PK",
    iso3: "PAK",
    currency: "PKR",
    branchName: "Pakistan Main Branch",
    branchCode: "PAK-MAIN",
    adminUserCode: "PAK-CA-000001"
  },
  {
    countryName: "Afghanistan",
    iso2: "AF",
    iso3: "AFG",
    currency: "AFN",
    branchName: "Afghanistan Main Branch",
    branchCode: "AFG-MAIN",
    adminUserCode: "AFG-CA-000001"
  }
];

async function ensureCountry(setup) {
  const [existing] = await sql`
    select id
    from countries
    where deleted_at is null
      and (lower(name) = lower(${setup.countryName}) or upper(iso3) = upper(${setup.iso3}))
    limit 1
  `;
  if (existing?.id) return existing.id;

  const [inserted] = await sql`
    insert into countries (name, iso2, iso3, currency_code, reporting_currency, is_active)
    values (${setup.countryName}, ${setup.iso2}, ${setup.iso3}, ${setup.currency}, 'USD', true)
    returning id
  `;
  return inserted.id;
}

async function ensureMainBranch(setup, countryId) {
  const [existing] = await sql`
    select id
    from country_branches
    where country_id = ${countryId}
      and deleted_at is null
      and (is_main = true or upper(code) = upper(${setup.branchCode}))
    order by is_main desc, created_at asc
    limit 1
  `;
  if (existing?.id) {
    await sql`
      update country_branches
      set permission_template = 'country-standard',
          permission_grants = ${sql.json(countryStandardPermissionGroups)},
          updated_at = now()
      where id = ${existing.id}
    `;
    return existing.id;
  }

  const [inserted] = await sql`
    insert into country_branches (country_id, name, code, local_currency, is_main, status, permission_template, permission_grants)
    values (${countryId}, ${setup.branchName}, ${setup.branchCode}, ${setup.currency}, true, 'active', 'country-standard', ${sql.json(countryStandardPermissionGroups)})
    returning id
  `;
  return inserted.id;
}

async function ensureCountryAdminAssignment(setup, countryId) {
  let [profile] = await sql`
    select id, full_name, user_code, raw_password
    from profiles
    where deleted_at is null
      and upper(user_code) = upper(${setup.adminUserCode})
    limit 1
  `;

  if (!profile?.id) {
    // Create the user in Supabase auth
    const email = ${'`${setup.adminUserCode.toLowerCase()}@test.com`'};
    const password = "TestUser@1234";

    let authUser;
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { user_code: setup.adminUserCode, full_name: ${'`${setup.countryName} Admin`'} }
    });

    if (error && error.message.includes('already registered')) {
      const { data: searchData } = await supabaseAdmin.auth.admin.listUsers();
      authUser = searchData?.users?.find(u => u.email === email);
    } else if (error) {
       return { status: ${'`auth_error: ${error.message}`'}, userCode: setup.adminUserCode };
    } else {
       authUser = data.user;
    }

    if (!authUser?.id) return { status: "missing_auth", userCode: setup.adminUserCode };

    // Wait for trigger to create profile
    await new Promise(r => setTimeout(r, 1000));
    const [existingProfile] = await sql`select id from profiles where id = ${authUser.id}`;
    if (!existingProfile?.id) {
       await sql`insert into profiles (id, full_name, user_code, raw_password) values (${authUser.id}, ${setup.countryName + ' Admin'}, ${setup.adminUserCode}, ${password})`;
    } else {
       await sql`update profiles set user_code = ${setup.adminUserCode}, raw_password = ${password} where id = ${authUser.id}`;
    }

    [profile] = await sql`select id, full_name, user_code, raw_password from profiles where id = ${authUser.id}`;
  }

  await sql`
    insert into user_role_assignments (user_id, role, country_id, country_branch_id, city_branch_id, is_active, created_by)
    select ${profile.id}, 'country_admin'::app_role, ${countryId}, null, null, true, null
    where not exists (
      select 1
      from user_role_assignments
      where user_id = ${profile.id}
        and role = 'country_admin'::app_role
        and country_id = ${countryId}
        and deleted_at is null
    )
  `;

  await sql`
    insert into user_permission_sets (user_id, permissions, source, updated_at)
    values (${profile.id}, ${sql.json(countryAdminPermissions)}, 'country_admin_default', now())
    on conflict (user_id) do update
      set permissions = excluded.permissions,
          source = excluded.source,
          updated_at = now()
  `;

  return {
    status: "assigned",
    userCode: profile.user_code,
    fullName: profile.full_name,
    password: profile.raw_password
  };
}

async function main() {
  const results = [];

  await sql.begin(async (tx) => {
    for (const setup of countrySetups) {
      const countryId = await ensureCountry(setup);
      const branchId = await ensureMainBranch(setup, countryId);
      const admin = await ensureCountryAdminAssignment(setup, countryId);

      results.push({
        country: setup.countryName,
        countryId,
        mainBranch: setup.branchName,
        branchCode: setup.branchCode,
        branchId,
        admin
      });
    }
  });

  const counts = {
    countries: (await sql`select count(*)::int as c from countries where deleted_at is null`)[0].c,
    countryBranches: (await sql`select count(*)::int as c from country_branches where deleted_at is null`)[0].c,
    cityBranches: (await sql`select count(*)::int as c from city_branches where deleted_at is null`)[0].c,
    roleAssignments: (await sql`select count(*)::int as c from user_role_assignments where deleted_at is null`)[0].c
  };

  console.log("Country/main branch user stitching completed.");
  console.table(results.map((row) => ({
    country: row.country,
    branch: row.mainBranch,
    branchCode: row.branchCode,
    adminUser: row.admin.userCode,
    adminName: row.admin.fullName || row.admin.status,
    password: row.admin.password || "-"
  })));
  console.log("Counts:", counts);
}

try {
  await main();
} catch (error) {
  console.error("Failed to ensure country branch users:");
  console.error(error?.message || error);
  process.exitCode = 1;
} finally {
  await sql.end();
}

async function main() {
  const results = [];

  await sql.begin(async (tx) => {
    for (const setup of countrySetups) {
      const countryId = await ensureCountry(setup);
      const branchId = await ensureMainBranch(setup, countryId);
      const admin = await ensureCountryAdminAssignment(setup, countryId);

      results.push({
        country: setup.countryName,
        countryId,
        mainBranch: setup.branchName,
        branchCode: setup.branchCode,
        branchId,
        admin
      });
    }
  });

  const counts = {
    countries: (await sql`select count(*)::int as c from countries where deleted_at is null`)[0].c,
    countryBranches: (await sql`select count(*)::int as c from country_branches where deleted_at is null`)[0].c,
    cityBranches: (await sql`select count(*)::int as c from city_branches where deleted_at is null`)[0].c,
    roleAssignments: (await sql`select count(*)::int as c from user_role_assignments where deleted_at is null`)[0].c
  };

  console.log("Country/main branch user stitching completed.");
  console.table(results.map((row) => ({
    country: row.country,
    branch: row.mainBranch,
    branchCode: row.branchCode,
    adminUser: row.admin.userCode,
    adminName: row.admin.fullName || row.admin.status,
    password: row.admin.password || "-"
  })));
  console.log("Counts:", counts);
}

try {
  await main();
} catch (error) {
  console.error("Failed to ensure country branch users:");
  console.error(error?.message || error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
