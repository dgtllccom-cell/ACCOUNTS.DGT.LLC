import crypto from "node:crypto";
import fs from "node:fs";
import postgres from "postgres";

function readEnvFile(fileName) {
  if (!fs.existsSync(fileName)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(fileName, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [
          line.slice(0, separator).trim(),
          line
            .slice(separator + 1)
            .trim()
            .replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
}

const env = {
  ...readEnvFile(".env"),
  ...readEnvFile(".env.local"),
  ...readEnvFile(".env.production"),
  ...process.env,
};

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured.");
}

const sql = postgres(env.DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 20,
  idle_timeout: 20,
});

const keepCountryCodes = ["AE", "PK", "AF"];
const expectedRoles = ["super_admin", "country_admin", "main_branch_admin"];

function databaseIdentity() {
  const databaseUrl = new URL(env.DATABASE_URL);
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "";
  return {
    databaseHost: databaseUrl.hostname,
    databaseName: databaseUrl.pathname.replace(/^\//, ""),
    supabaseProjectRef:
      supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co/i)?.[1] || null,
    databaseFingerprint: crypto
      .createHash("sha256")
      .update(`${databaseUrl.hostname}/${databaseUrl.pathname}`)
      .digest("hex")
      .slice(0, 12),
  };
}

async function tableExists(tableName) {
  const [row] = await sql`
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = ${tableName}
    ) as exists
  `;
  return Boolean(row?.exists);
}

async function countRows(tableName, whereSql = "true") {
  if (!(await tableExists(tableName))) return null;
  const [row] = await sql.unsafe(
    `select count(*)::bigint as count from public."${tableName.replaceAll('"', '""')}" where ${whereSql}`,
  );
  return Number(row?.count || 0);
}

async function getReferenceCounts(targetTable, targetColumn, ids) {
  if (!ids.length) return {};
  const rows = await sql`
    select
      tc.table_name,
      kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
      and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name
      and tc.table_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and ccu.table_name = ${targetTable}
      and ccu.column_name = ${targetColumn}
    order by tc.table_name, kcu.column_name
  `;

  const result = {};
  for (const row of rows) {
    const safeTable = row.table_name.replaceAll('"', '""');
    const safeColumn = row.column_name.replaceAll('"', '""');
    const [count] = await sql.unsafe(
      `select count(*)::bigint as count
       from public."${safeTable}"
       where "${safeColumn}" = any($1::uuid[])`,
      [ids],
    );
    result[`${row.table_name}.${row.column_name}`] = Number(count?.count || 0);
  }
  return result;
}

async function run() {
  const countries = await sql`
    select id, name, iso2 as code, currency_code, is_active
    from countries
    where upper(iso2) in ${sql(keepCountryCodes)}
    order by iso2
  `;
  const countryIds = countries.map((row) => row.id);

  const mainBranches = await sql`
    select
      cb.id,
      cb.country_id,
      cb.name,
      cb.code,
      cb.status,
      c.iso2 as country_code
    from country_branches cb
    join countries c on c.id = cb.country_id
    where cb.country_id in ${sql(countryIds)}
    order by c.iso2, cb.created_at, cb.id
  `;

  const extraMainBranches = await sql`
    select
      cb.id,
      cb.country_id,
      cb.name,
      cb.code,
      c.name as country_name,
      c.iso2 as country_code
    from country_branches cb
    join countries c on c.id = cb.country_id
    where cb.country_id not in ${sql(countryIds)}
    order by c.name, cb.name
  `;

  const cityBranches = await sql`
    select
      city.id,
      city.country_id,
      city.country_branch_id,
      city.name,
      city.code,
      city.created_by,
      city.created_at,
      c.iso2 as country_code,
      cb.name as main_branch_name
    from city_branches city
    join countries c on c.id = city.country_id
    left join country_branches cb on cb.id = city.country_branch_id
    order by c.iso2, city.created_at, city.id
  `;

  const roleSummary = await sql`
    select
      ura.role::text as role,
      count(*)::int as assignments,
      count(distinct ura.user_id)::int as users
    from user_role_assignments ura
    group by ura.role
    order by ura.role
  `;

  const repeatedAssignments = await sql`
    select
      user_id,
      role::text as role,
      country_id,
      country_branch_id,
      city_branch_id,
      count(*)::int as copies,
      min(created_at) as first_created_at,
      max(created_at) as last_created_at
    from user_role_assignments
    group by user_id, role, country_id, country_branch_id, city_branch_id
    having count(*) > 1
    order by copies desc, role
  `;

  const privilegedAssignments = await sql`
    select
      ura.id,
      ura.user_id,
      p.full_name,
      ura.role::text as role,
      ura.country_id,
      ura.country_branch_id,
      ura.city_branch_id,
      c.iso2 as country_code,
      cb.name as main_branch_name,
      city.name as city_branch_name,
      ura.created_at
    from user_role_assignments ura
    join profiles p on p.id = ura.user_id
    left join countries c on c.id = ura.country_id
    left join country_branches cb on cb.id = ura.country_branch_id
    left join city_branches city on city.id = ura.city_branch_id
    where ura.role::text in ${sql(expectedRoles)}
    order by ura.role, c.iso2, ura.created_at
  `;

  const profileAssignments = await sql`
    select
      p.id as user_id,
      p.full_name,
      ura.id as assignment_id,
      ura.role::text as role,
      c.iso2 as country_code,
      cb.code as main_branch_code,
      city.code as city_branch_code,
      ura.is_active,
      ura.created_at
    from profiles p
    left join user_role_assignments ura on ura.user_id = p.id
    left join countries c on c.id = ura.country_id
    left join country_branches cb on cb.id = ura.country_branch_id
    left join city_branches city on city.id = ura.city_branch_id
    order by p.full_name, ura.created_at, ura.id
  `;

  const roleCoverage = Object.fromEntries(
    keepCountryCodes.map((code) => [
      code,
      {
        countryAdmins: privilegedAssignments.filter(
          (row) => row.role === "country_admin" && row.country_code === code,
        ).length,
        mainBranchAdmins: privilegedAssignments.filter(
          (row) => row.role === "main_branch_admin" && row.country_code === code,
        ).length,
      },
    ]),
  );

  const obviousDemoCounts = {
    purchaseOrdersMissingAllScope: await countRows(
      "purchase_orders",
      "country_id is null and country_branch_id is null and city_branch_id is null and created_by is null",
    ),
    roznamchaMissingAllScope: await countRows(
      "roznamcha_entries",
      "country_id is null and city_branch_id is null and created_by is null",
    ),
    enterpriseAccountsWithoutCreator: await countRows(
      "enterprise_accounts",
      "created_by is null",
    ),
  };

  const extraMainBranchIds = extraMainBranches.map((row) => row.id);
  const cityBranchIds = cityBranches.map((row) => row.id);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "DRY_RUN_ONLY",
    database: databaseIdentity(),
    preservationRules: {
      globalLocationCountriesPreserved: true,
      worldwideCountryRows: await countRows("countries"),
      statesProvinces: await countRows("states_provinces"),
      cities: await countRows("cities"),
      postalCodes: await countRows("postal_codes"),
      coreSettingsUntouched: true,
      noRowsChanged: true,
    },
    keepList: {
      countries,
      mainBranches,
    },
    cleanupCandidates: {
      extraMainBranches,
      cityBranches,
      repeatedRoleAssignments: repeatedAssignments,
      obviousDemoCounts,
    },
    userReadiness: {
      profileCount: await countRows("profiles"),
      profileAssignments,
      roleSummary,
      roleCoverage,
      missingRequiredAdmins: Object.entries(roleCoverage)
        .flatMap(([countryCode, coverage]) => [
          ...(coverage.countryAdmins === 0
            ? [`${countryCode}: country_admin`]
            : []),
          ...(coverage.mainBranchAdmins === 0
            ? [`${countryCode}: main_branch_admin`]
            : []),
        ]),
      superAdminAssignments: privilegedAssignments.filter(
        (row) => row.role === "super_admin",
      ).length,
    },
    referenceImpact: {
      extraMainBranches: await getReferenceCounts(
        "country_branches",
        "id",
        extraMainBranchIds,
      ),
      allCityBranches: await getReferenceCounts(
        "city_branches",
        "id",
        cityBranchIds,
      ),
    },
    nextAction:
      "Review this report before running any cleanup. This script never deletes or updates data.",
  };

  console.log(JSON.stringify(report, null, 2));
}

try {
  await run();
} finally {
  await sql.end();
}






