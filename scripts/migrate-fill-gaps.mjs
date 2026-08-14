import fs from "node:fs";
import postgres from "postgres";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i)] = t.slice(i + 1).replace(/^"|"$/g, "");
  }
  return env;
}
const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const LOCAL = env.DATABASE_URL;
const VPS = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

// Tables where LOCAL genuinely has data VPS lacks, in dependency order.
// (Determined from migrate-compare-counts.mjs baseline.)
const GAP_TABLES = [
  "city_branches",
  "districts",
  "areas_locations",
  "employees",
  "customer_contacts"
];

const local = postgres(LOCAL, { max: 1, prepare: false, connect_timeout: 30 });
const vps = postgres(VPS, { max: 1, prepare: false, connect_timeout: 30 });

async function commonColumns(table) {
  const lc = await local.unsafe(
    `select column_name from information_schema.columns where table_schema='public' and table_name=$1`, [table]);
  const vc = await vps.unsafe(
    `select column_name from information_schema.columns where table_schema='public' and table_name=$1`, [table]);
  const vset = new Set(vc.map(r => r.column_name));
  return lc.map(r => r.column_name).filter(c => vset.has(c));
}

async function count(db, table) {
  const r = await db.unsafe(`select count(*)::int as c from public."${table}"`);
  return r[0].c;
}

const report = [];

for (const table of GAP_TABLES) {
  const before = await count(vps, table);
  const localCount = await count(local, table);
  const cols = await commonColumns(table);
  if (!cols.includes("id")) {
    report.push({ table, localCount, before, inserted: 0, skippedFk: 0, error: "no id column" });
    continue;
  }
  const rows = await local.unsafe(`select ${cols.map(c => `"${c}"`).join(",")} from public."${table}"`);
  let inserted = 0, skippedFk = 0, skippedOther = 0;
  const colList = cols.map(c => `"${c}"`).join(",");

  for (const row of rows) {
    const vals = cols.map(c => row[c]);
    const ph = cols.map((_, i) => `$${i + 1}`).join(",");
    try {
      const res = await vps.unsafe(
        `insert into public."${table}" (${colList}) values (${ph}) on conflict (id) do nothing`,
        vals
      );
      // postgres.js returns count on unsafe for INSERT via res.count
      if (res.count && res.count > 0) inserted += res.count;
    } catch (e) {
      const msg = String(e.message || "");
      if (msg.includes("foreign key") || msg.includes("violates foreign key")) skippedFk++;
      else skippedOther++;
    }
  }
  const after = await count(vps, table);
  report.push({ table, localCount, before, after, inserted, skippedFk, skippedOther });
  console.log(`${table.padEnd(20)} local=${localCount} vpsBefore=${before} inserted=${inserted} skippedFK=${skippedFk} skippedOther=${skippedOther} vpsAfter=${after}`);
}

console.log("\n=== RECONCILIATION ===");
console.log(JSON.stringify(report, null, 2));
process.exit(0);
