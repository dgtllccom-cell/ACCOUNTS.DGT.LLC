// Apply the Country-to-Country Purchase Phase 1 migration (destination scope on purchase_orders).
// Run: node scripts/apply-purchase-orders-destination-scope.mjs [--vps]
import fs from "node:fs";
import postgres from "postgres";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const isVps = process.argv.includes("--vps");
const VPS_URL =
  "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const dbUrl = isVps ? VPS_URL : env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not configured");
  process.exit(1);
}

const migrationName = "20260821_purchase_orders_destination_scope";
const migrationPath = "supabase/migrations/20260821_purchase_orders_destination_scope.sql";

const sql = postgres(dbUrl, { max: 1, prepare: false, connect_timeout: 30 });

try {
  console.log(`Target: ${isVps ? "VPS (production)" : "dev"}`);
  await sql`create table if not exists erp_schema_migrations (name text primary key, status text not null, applied_at timestamptz not null default now())`;

  const existing = await sql`select name, status from erp_schema_migrations where name = ${migrationName}`;
  if (existing.length && existing[0].status === "applied") {
    console.log(`[SKIP] Already applied: ${migrationName}`);
  } else {
    console.log(`[APPLYING] ${migrationName}...`);
    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    await sql.unsafe(migrationSql);
    await sql`insert into erp_schema_migrations (name, status) values (${migrationName}, 'applied') on conflict (name) do update set status='applied', applied_at=now()`;
    console.log(`[SUCCESS] Applied: ${migrationName}`);
  }

  const colCheck = await sql`
    select column_name from information_schema.columns
    where table_name = 'purchase_orders' and column_name in ('dest_country_id', 'dest_country_branch_id', 'dest_city_branch_id')
    order by column_name
  `;
  console.log(JSON.stringify({ ok: true, dest_columns_present: colCheck.map((r) => r.column_name) }, null, 2));
} catch (error) {
  console.error("MIGRATION FAILED:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
