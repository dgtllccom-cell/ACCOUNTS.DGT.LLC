import crypto from "node:crypto";
import fs from "node:fs";
import postgres from "postgres";

const KEEP_COUNTRY_CODES = ["AE", "PK", "AF", "IR", "IN"];

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
          line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
}

const fileEnv = {
  ...readEnvFile(".env"),
  ...readEnvFile(".env.local"),
  ...readEnvFile(".env.production"),
};
const env = process.env.DATABASE_URL
  ? { ...fileEnv, ...process.env }
  : { ...fileEnv, ...process.env };

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");

const sql = postgres(env.DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 30,
  idle_timeout: 30,
});

function databaseIdentity() {
  const url = new URL(env.DATABASE_URL);
  return {
    host: url.hostname,
    database: url.pathname.replace(/^\//, ""),
    fingerprint: crypto
      .createHash("sha256")
      .update(`${url.hostname}/${url.pathname}`)
      .digest("hex")
      .slice(0, 12),
  };
}

async function tableExists(tableName) {
  const [row] = await sql`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = ${tableName}
    ) as exists
  `;
  return Boolean(row?.exists);
}

async function safeCount(tableName) {
  if (!(await tableExists(tableName))) return null;
  const safe = tableName.replaceAll('"', '""');
  const [row] = await sql.unsafe(`select count(*)::bigint as count from public."${safe}"`);
  return Number(row?.count || 0);
}

async function run() {
  const countries = await sql`
    select id, iso2 as code, name, currency_code, is_active, created_at
    from public.countries
    where upper(iso2) = any(${KEEP_COUNTRY_CODES})
    order by iso2, created_at, id
  `;
  const allCountries = await sql`
    select id, iso2 as code, name, currency_code, is_active, created_at
    from public.countries
    order by iso2 nulls last, created_at, id
  `;
  const branches = await sql`
    select cb.id, cb.country_id, cb.code, cb.name, cb.status, cb.created_at,
           c.iso2 as country_code, c.name as country_name
    from public.country_branches cb
    join public.countries c on c.id = cb.country_id
    order by c.iso2, cb.created_at, cb.id
  `;
  const cityBranches = await sql`
    select city.id, city.country_id, city.country_branch_id, city.code, city.name,
           city.status, city.created_at, c.iso2 as country_code
    from public.city_branches city
    join public.countries c on c.id = city.country_id
    order by c.iso2, city.created_at, city.id
  `;
  const assignments = await sql`
    select ura.id, ura.user_id, p.full_name,
           ura.role::text as role, ura.country_id, ura.country_branch_id,
           ura.city_branch_id, ura.is_active, ura.created_at,
           c.iso2 as country_code, cb.code as branch_code, cb.name as branch_name
    from public.user_role_assignments ura
    join public.profiles p on p.id = ura.user_id
    left join public.countries c on c.id = ura.country_id
    left join public.country_branches cb on cb.id = ura.country_branch_id
    where ura.role::text in ('super_admin', 'country_admin', 'main_branch_admin')
    order by ura.role, c.iso2, ura.created_at, ura.id
  `;

  const tableRows = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `;
  const transactionPattern = /(purchase|sale|journal|roznamcha|ledger|payment|receipt|loading|shipping|container|stock|invoice|voucher|cash|goods_entry|transfer|posting|exchange_rate)/i;
  const transactionCandidates = [];
  for (const row of tableRows) {
    if (!transactionPattern.test(row.table_name)) continue;
    transactionCandidates.push({
      table: row.table_name,
      rows: await safeCount(row.table_name),
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "READ_ONLY",
    database: databaseIdentity(),
    requestedCountryCodes: KEEP_COUNTRY_CODES,
    countries,
    duplicateRequestedCountries: countries.filter(
      (country, index) =>
        countries.findIndex((candidate) => candidate.code === country.code) !== index,
    ),
    extraCountries: allCountries.filter(
      (country) => !KEEP_COUNTRY_CODES.includes(String(country.code || '').toUpperCase()),
    ),
    mainBranches: branches,
    cityBranches,
    privilegedAssignments: assignments,
    coverage: Object.fromEntries(
      KEEP_COUNTRY_CODES.map((code) => [
        code,
        {
          countries: countries.filter((row) => row.code === code).length,
          mainBranches: branches.filter((row) => row.country_code === code).length,
          countryAdmins: assignments.filter(
            (row) => row.country_code === code && row.role === "country_admin",
          ).length,
          mainBranchAdmins: assignments.filter(
            (row) => row.country_code === code && row.role === "main_branch_admin",
          ).length,
        },
      ]),
    ),
    globalSuperAdmins: assignments.filter((row) => row.role === "super_admin"),
    tableCounts: {
      countries: allCountries.length,
      countryBranches: branches.length,
      cityBranches: cityBranches.length,
      profiles: await safeCount("profiles"),
      roleAssignments: await safeCount("user_role_assignments"),
    },
    transactionCandidates,
  };

  fs.mkdirSync("reports", { recursive: true });
  const output = "reports/five-country-cleanup-audit.json";
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    output,
    database: report.database,
    coverage: report.coverage,
    globalSuperAdmins: report.globalSuperAdmins.length,
    extraCountries: report.extraCountries.length,
    tableCounts: report.tableCounts,
    transactionCandidateRows: report.transactionCandidates.reduce(
      (sum, row) => sum + Number(row.rows || 0),
      0,
    ),
  }, null, 2));
}

try {
  await run();
} finally {
  await sql.end({ timeout: 5 });
}
