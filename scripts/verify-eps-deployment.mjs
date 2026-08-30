/**
 * Read-only EPS / Production verification.
 *
 * Needs PROD_DATABASE_URL in .env.local (a connection string — never printed).
 * Verifies migration state, DGT Connect + translation-memory tables, and that no
 * destructive cleanup has run.  Makes NO writes.
 *
 *   node scripts/verify-eps-deployment.mjs
 */
import postgres from "postgres";
import { resolveDbUrl } from "./lib/prod-db-url.mjs";

const sql = postgres(resolveDbUrl("prod"), { max: 1, prepare: false, connect_timeout: 60 });

const EXPECT_MIGRATIONS = [
  "20261009_doc_intake_master_document_types",
  "20261010_doc_intake_contract_route",
  "20261011_doc_intake_employee_expense_types",
  "20261012_dgt_connect",
  "20261013_erp_translation_memory",
];
const DGT_TABLES = [
  "dgt_conversations", "dgt_conversation_participants", "dgt_messages",
  "dgt_message_receipts", "dgt_message_translations", "dgt_presence",
];
const I18N_TABLES = ["erp_translation_memory", "erp_translation_memory_audit"];
const DESTRUCTIVE = ["20261008_cleanup_user_directory_master", "20261008_cleanup_dev_users_directory"];

try {
  const out = { ok: true, checks: [] };
  const add = (name, pass, detail) => { out.checks.push({ name, pass, detail }); if (!pass) out.ok = false; };

  const mig = await sql`select name, status, applied_at from public.erp_schema_migrations where name = any(${EXPECT_MIGRATIONS}) order by name`;
  const applied = new Map(mig.map((m) => [m.name, m.status]));
  for (const m of EXPECT_MIGRATIONS) add(`migration ${m}`, applied.get(m) === "applied", applied.get(m) || "NOT APPLIED");

  const dtrows = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name = any(${[...DGT_TABLES, ...I18N_TABLES]})`;
  const present = new Set(dtrows.map((r) => r.table_name));
  for (const t of DGT_TABLES) add(`table public.${t}`, present.has(t), present.has(t) ? "exists" : "MISSING");
  for (const t of I18N_TABLES) add(`table public.${t}`, present.has(t), present.has(t) ? "exists" : "MISSING");

  if (present.has("erp_translation_memory")) {
    const [{ n }] = await sql`select count(*)::int n from public.erp_translation_memory`;
    const [{ g }] = await sql`select count(*)::int g from public.erp_translation_memory where status in ('glossary','approved')`;
    add("translation memory seeded", n >= 200, `${n} rows (${g} glossary/approved)`);
  }
  if (present.has("dgt_conversations")) {
    const [{ n }] = await sql`select count(*)::int n from public.dgt_conversations`;
    add("dgt_conversations queryable", true, `${n} rows`);
  }

  const destr = await sql`select name, status from public.erp_schema_migrations where name = any(${DESTRUCTIVE})`;
  add("destructive 20261008_* NOT applied to prod", destr.every((d) => d.status !== "applied"),
      destr.length ? JSON.stringify(destr) : "no rows (good)");

  const [{ pc }] = await sql`select count(*)::int pc from public.profiles where deleted_at is null`;
  add("prod profiles present (not reset)", pc > 30, `${pc} live profiles`);

  console.log(JSON.stringify(out, null, 2));
  process.exitCode = out.ok ? 0 : 1;
} catch (e) {
  console.error("verify-eps failed:", e.message || e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
