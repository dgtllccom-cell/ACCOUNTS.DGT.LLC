import fs from "node:fs";
import postgres from "postgres";

const confirmFlag = "--confirm-full-reset-except-spreadsheet-expiry";
const applyChanges = process.argv.includes(confirmFlag);

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 20,
});

const structuralPreserve = new Set([
  "erp_schema_migrations",
  "local_applied_migrations",
  "languages",
  "translation_keys",
  "translation_values",
  "roles",
  "permissions",
  "role_permissions",
  "erp_modules",
  "module_dependencies",
]);

const preserveNamePatterns = [
  /spreadsheet/i,
  /expiry/i,
  /expire/i,
  /expiration/i,
];

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

async function publicTables(db = sql) {
  return db`
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename
  `.then((rows) => rows.map((row) => row.tablename));
}

async function columnsFor(table, db = sql) {
  return db`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = ${table}
    order by ordinal_position
  `.then((rows) => rows.map((row) => row.column_name));
}

async function countRows(table, db = sql) {
  const [row] = await db.unsafe(`select count(*)::int as count from public.${quoteIdent(table)}`);
  return row.count;
}

async function snapshot(tables, db = sql) {
  const counts = {};
  for (const table of tables) counts[table] = await countRows(table, db);
  return counts;
}

function shouldPreserveTable(table) {
  if (structuralPreserve.has(table)) return true;
  return preserveNamePatterns.some((pattern) => pattern.test(table));
}

async function findSuperAdmin(db = sql) {
  const profiles = await db`
    select p.*
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(coalesce(u.email, '')) like '%superadmin%'
       or lower(coalesce(p.full_name, '')) like '%super admin%'
       or lower(coalesce(p.user_code, '')) in ('superadmin', 'super_admin')
    order by p.created_at nulls last
    limit 1
  `.catch(async () => {
    return db`
      select *
      from public.profiles
      where lower(coalesce(full_name, '')) like '%super admin%'
         or lower(coalesce(user_code, '')) in ('superadmin', 'super_admin')
      order by created_at nulls last
      limit 1
    `.catch(() => []);
  });
  return profiles[0] ?? null;
}

async function insertProfile(row, db) {
  if (!row) return false;
  const cols = await columnsFor("profiles", db);
  const payload = {};
  for (const col of cols) {
    if (col in row) payload[col] = row[col];
  }
  if ("role" in payload && !payload.role) payload.role = "super_admin";
  if ("updated_at" in payload) payload.updated_at = new Date();
  await db`insert into public.profiles ${db(payload)}`;
  return true;
}

try {
  const allTables = await publicTables();
  const preservedTables = allTables.filter(shouldPreserveTable);
  const resetTables = allTables.filter((table) => !shouldPreserveTable(table));
  const spreadsheetExpiryTables = preservedTables.filter((table) =>
    preserveNamePatterns.some((pattern) => pattern.test(table))
  );

  const beforeReset = await snapshot(resetTables);
  const beforePreserved = await snapshot(preservedTables);
  const superAdmin = allTables.includes("profiles") ? await findSuperAdmin() : null;

  if (!applyChanges) {
    console.log(JSON.stringify({
      status: "dry_run",
      mode: `no changes; rerun with ${confirmFlag}`,
      note: "auth.users is not touched. One Super Admin public profile will be restored after reset.",
      spreadsheetExpiryTables,
      preservedTables,
      resetTables,
      resetBefore: beforeReset,
      preservedBefore: beforePreserved,
      superAdminProfileFound: Boolean(superAdmin),
      superAdminProfileId: superAdmin?.id ?? null,
    }, null, 2));
    process.exit(0);
  }

  const results = [];
  await sql.begin(async (tx) => {
    const candidates = resetTables.filter((table) => table !== "profiles");

    if (candidates.length) {
      await tx.unsafe(
        `truncate table ${candidates.map((table) => `public.${quoteIdent(table)}`).join(", ")} restart identity cascade`
      );
    }

    for (const table of candidates) {
      results.push({ table, status: "truncated", before: beforeReset[table], after: await countRows(table, tx) });
    }

    if (resetTables.includes("profiles")) {
      await tx`delete from public.profiles`;
      const restored = await insertProfile(superAdmin, tx);
      results.push({
        table: "profiles",
        status: restored ? "reset_and_restored_super_admin" : "reset_no_super_admin_found",
        before: beforeReset.profiles,
        after: await countRows("profiles", tx),
      });
    }
  });

  const afterReset = await snapshot(resetTables);
  const afterPreserved = await snapshot(preservedTables);

  console.log(JSON.stringify({
    status: "success",
    note: "Full ERP reset applied. Spreadsheet/expiry-named tables and system structural tables were preserved. auth.users was not touched.",
    spreadsheetExpiryTables,
    preservedTables,
    resetTables,
    resetBefore: beforeReset,
    resetAfter: afterReset,
    preservedBefore: beforePreserved,
    preservedAfter: afterPreserved,
    superAdminProfileFound: Boolean(superAdmin),
    superAdminProfileId: superAdmin?.id ?? null,
    results,
  }, null, 2));
} catch (error) {
  console.error("FULL_RESET_EXCEPT_SPREADSHEET_EXPIRY_FAILED", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
