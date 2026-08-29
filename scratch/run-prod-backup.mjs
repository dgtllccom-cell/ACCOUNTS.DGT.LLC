import fs from "node:fs";
import { execSync } from "node:child_process";
const PROD = fs.readFileSync("scripts/backup-vps-db.mjs","utf8").match(/postgresql:\/\/[^\s'"]+/)[0];
const stamp = new Date().toISOString().replace(/[:.]/g,"-");
const out = `backups/PROD-pre-release-${stamp}`;
console.log("Backing up PRODUCTION → " + out);
execSync(`node scripts/db-backup-engine.mjs --output "${out}"`, {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: PROD },
});
// verify
const manifest = JSON.parse(fs.readFileSync(`${out}/manifest.json`,"utf8"));
const tbls = Object.keys(manifest.tables || {});
const totalRows = tbls.reduce((s,t)=>s+(manifest.tables[t].rowCount||0),0);
const files = fs.readdirSync(out);
console.log(`\n[VERIFY] manifest tables: ${tbls.length} | total rows: ${totalRows} | files: ${files.length}`);
console.log(`[VERIFY] key tables:`, ["purchase_orders","purchase_order_payments","roznamcha_entries","roznamcha_lines","ledgers","employees","customers"].map(t=>`${t}=${manifest.tables[t]?.rowCount ?? "?"}`).join(" "));
const sizeMB = (files.reduce((s,f)=>s+fs.statSync(`${out}/${f}`).size,0)/1048576).toFixed(1);
console.log(`[VERIFY] backup size: ${sizeMB} MB  — OK if > 1 MB and tables > 150`);
fs.writeFileSync("scratch/prod-backup-path.txt", out);
