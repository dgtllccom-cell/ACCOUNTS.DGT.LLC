import fs from "node:fs";
import postgres from "postgres";

function loadEnvLocal() {
  const path = "c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/.env.local";
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });

try {
  const entries = await sql.unsafe(
    `select id, type, journal_no, voucher_no, country_id, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number
     from roznamcha_entries
     where voucher_no in ('V-20260613-83JP', 'V-20260613-XHUC')`
  );
  console.log("Entries:", JSON.stringify(entries, null, 2));

  for (const entry of entries) {
    const lines = await sql.unsafe(
      `select id, payment_entry_type, debit, credit, currency, usd_rate, usd_amount, ledger_id
       from roznamcha_lines
       where roznamcha_entry_id = $1`,
       [entry.id]
    );
    console.log(`Lines for ${entry.voucher_no}:`, JSON.stringify(lines, null, 2));
  }
} catch (e) {
  console.error(e);
} finally {
  await sql.end();
}
