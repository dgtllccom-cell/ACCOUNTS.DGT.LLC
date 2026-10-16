/**
 * DEV only: apply one SQL file in a single transaction.   node scripts/dev/apply-sql-dev.mjs <file.sql>
 * Refuses to run unless DATABASE_URL points at the DEV Supabase project (never Production).
 */
import fs from "node:fs";
import postgres from "postgres";

const env = {};
for (const f of [".env", ".env.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
const url = process.env.DATABASE_URL || env.DATABASE_URL;
const DEV = env.DEV_SUPABASE_REF || "csesvyxxjivnkkozgopt";
const PROD = env.PROD_SUPABASE_REF || "inmayhrxucimxqhgseqi";
if (!url) throw new Error("DATABASE_URL missing");
if (url.includes(PROD) || !url.includes(DEV)) throw new Error("Refusing: DATABASE_URL is not the DEV project.");
const file = process.argv[2];
if (!file) throw new Error("usage: apply-sql-dev.mjs <file.sql>");
const sqlText = fs.readFileSync(file, "utf8");
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  await sql.begin(async (tx) => { await tx.unsafe(sqlText); });
  console.log("applied to DEV:", file);
} finally {
  await sql.end({ timeout: 5 });
}
