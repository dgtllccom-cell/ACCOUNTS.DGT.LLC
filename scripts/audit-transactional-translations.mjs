// READ-ONLY audit: for each transactional table+field registered in translatable-fields.ts,
// compare base-table row count (with non-empty text) vs record_translations coverage.
// Run: node scripts/audit-transactional-translations.mjs [--vps]
import fs from "node:fs";
import postgres from "postgres";

function pe(f) { const e = {}; if (!fs.existsSync(f)) return e; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const t = l.trim(); if (!t || t.startsWith("#")) continue; const i = t.indexOf("="); if (i > -1) e[t.slice(0, i)] = t.slice(i + 1).replace(/^"|"$/g, ""); } return e; }
const env = { ...pe(".env"), ...pe(".env.local") };
const url = process.argv.includes("--vps")
  ? "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"
  : env.DATABASE_URL;
const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 30 });

const TRANSACTIONAL = [
  ["roznamcha_entries", "narration"],
  ["roznamcha_lines", "description"],
  ["journal_entries", "memo"],
  ["journal_lines", "description"],
  ["ledger_posting_batches", "narration"],
  ["ledger_posting_lines", "description"],
  ["ledger_posting_lines", "remarks"],
  ["transactions", "description"],
  ["inter_branch_ledger_transfers", "remarks"],
  ["purchase_order_expenses", "description"],
  ["purchase_order_payments", "narration"],
  ["sales_order_payments", "remarks"],
  ["approval_status_history", "note"],
  ["expenses_bills", "bill_title"],
  ["money_exchange_entries", "receipt_name"],
];

for (const [table, field] of TRANSACTIONAL) {
  let baseCount = null;
  try {
    const r = await sql.unsafe(
      `select count(*)::int c from ${table} where "${field}" is not null and btrim("${field}"::text) <> ''`
    );
    baseCount = r[0].c;
  } catch (e) {
    console.log(`${table}.${field.padEnd(14)} BASE TABLE/FIELD ERROR: ${e.message.split("\n")[0]}`);
    continue;
  }
  const tr = await sql.unsafe(
    `select count(*)::int c from record_translations where record_table=$1 and field_name=$2 and deleted_at is null`,
    [table, field]
  );
  const trCount = tr[0].c;
  const gap = baseCount - trCount;
  console.log(`${table}.${field.padEnd(14)} base_rows_with_text=${String(baseCount).padStart(6)}  record_translations_rows=${String(trCount).padStart(6)}  gap=${gap}`);
}
process.exit(0);
