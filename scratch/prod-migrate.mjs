import fs from "node:fs";
import postgres from "postgres";

const PROD = fs.readFileSync("scripts/backup-vps-db.mjs", "utf8").match(/postgresql:\/\/[^\s'"]+/)[0];

// migration list — parsed straight from the canonical DEV runner so it never drifts
const runnerSrc = fs.readFileSync("scripts/db-apply-all-migrations.mjs", "utf8");
const migrations = [...runnerSrc.matchAll(/\{\s*name:\s*"([^"]+)",\s*path:\s*"([^"]+)"\s*\}/g)]
  .map(m => ({ name: m[1], path: m[2] }));
console.log(`migration list: ${migrations.length} entries (from db-apply-all-migrations.mjs)\n`);

const mode = process.argv[2] || "dry";   // "dry" = report only; "apply" = apply missing
const sql = postgres(PROD, { max: 1, prepare: false, connect_timeout: 60, ssl: { rejectUnauthorized: false } });

try {
  await sql`create table if not exists erp_schema_migrations (name text primary key, status text not null, applied_at timestamptz not null default now())`;
  const applied = new Set((await sql`select name from erp_schema_migrations where status='applied'`).map(r => r.name));
  const missing = migrations.filter(m => !applied.has(m.name));
  console.log(`PROD: ${applied.size} applied, ${missing.length} missing:\n` + missing.map(m => "  - " + m.name).join("\n"));

  if (mode !== "apply") { console.log("\n[DRY RUN] nothing applied. Re-run with 'apply' to migrate."); await sql.end(); process.exit(0); }

  console.log("\n=== APPLYING to PRODUCTION ===");
  for (const mig of missing) {
    if (!fs.existsSync(mig.path)) { console.error(`  ✗ FILE MISSING: ${mig.path} — STOPPING`); process.exitCode = 1; break; }
    process.stdout.write(`  [APPLYING] ${mig.name} ... `);
    try {
      await sql.unsafe(fs.readFileSync(mig.path, "utf8"));
      await sql`insert into erp_schema_migrations (name, status) values (${mig.name}, 'applied') on conflict (name) do update set status='applied', applied_at=now()`;
      console.log("OK");
    } catch (e) {
      console.log("FAILED");
      console.error(`\n  ✗ ${mig.name} failed: ${e.message}\n  STOPPING. Production DB is safe (this file rolled back its own BEGIN/COMMIT).`);
      process.exitCode = 1;
      break;
    }
  }
  if (!process.exitCode) {
    await sql`NOTIFY pgrst, 'reload schema'`;
    console.log("\n=== all missing migrations applied; PostgREST schema reload signalled ===");
  }
} catch (e) {
  console.error("RUNNER ERROR:", e.message); process.exitCode = 1;
} finally {
  await sql.end();
}
