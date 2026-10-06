import fs from "node:fs";
import postgres from "postgres";

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

const dbUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
console.log("Connecting to DB...");
const sql = postgres(dbUrl, { ssl: "require", max: 1 });

try {
  const ledgers = await sql`
    SELECT id, code, name, scope, currency, current_balance, debit_total, credit_total
    FROM ledgers
    WHERE deleted_at IS NULL
    LIMIT 20
  `;
  console.log("Ledgers count:", ledgers.length);
  console.table(ledgers);

  const rozCount = await sql`SELECT count(*) FROM roznamcha_lines`;
  console.log("Roznamcha lines count:", rozCount[0].count);

  const postingCount = await sql`SELECT count(*) FROM ledger_posting_lines`;
  console.log("Posting lines count:", postingCount[0].count);

  const rozSample = await sql`
    SELECT rl.id, rl.ledger_id, rl.debit, rl.credit, rl.description, re.entry_date, re.voucher_no
    FROM roznamcha_lines rl
    JOIN roznamcha_entries re ON rl.roznamcha_entry_id = re.id
    WHERE re.deleted_at IS NULL
    LIMIT 10
  `;
  console.log("Roznamcha sample:");
  console.table(rozSample);

} catch (e) {
  console.error("DB error:", e);
} finally {
  await sql.end();
}
