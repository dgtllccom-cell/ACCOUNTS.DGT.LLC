/**
 * Restore for scripts/dev-transaction-cleanup.mts (DEV ONLY).
 * Usage: vite-node --config vitest.config.mjs scripts/dev-transaction-restore.mts <backupDir> [--execute]
 * Default is a dry run (verifies every file against the manifest sha256 and prints what would be restored).
 * --execute re-inserts the deleted rows parents→children (reverse delete order) and restores the updated master columns,
 * all in one transaction.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { withLocalPg, getDbUrl } from "@/lib/db/local-postgres";
import { DELETE_ORDER } from "./dev-transaction-cleanup-order";

if (!getDbUrl().includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing: this is not the DEV database.");
const dir = process.argv[2];
const execute = process.argv.includes("--execute");
if (!dir || !fs.existsSync(path.join(dir, "manifest.json"))) throw new Error("usage: restore <backupDir> [--execute]");
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
const load = (name: string) => {
  const body = fs.readFileSync(path.join(dir, `${name}.json`), "utf8");
  const f = manifest.files.find((x: any) => x.name === name);
  if (!f || crypto.createHash("sha256").update(body).digest("hex") !== f.sha256) throw new Error("checksum mismatch: " + name);
  return JSON.parse(body) as Record<string, unknown>[];
};
for (const f of manifest.files) load(f.name);
console.log("manifest verified:", manifest.files.length, "files,", manifest.totalRows, "rows");
if (!execute) process.exit(0);

await withLocalPg(async (sql) => {
  await sql.begin(async (tx: any) => {
    for (const t of [...DELETE_ORDER].reverse()) {
      if (!manifest.files.some((x: any) => x.name === t)) continue;
      const rows = load(t);
      for (let i = 0; i < rows.length; i += 200) await tx`insert into ${tx(t)} ${tx(rows.slice(i, i + 200))}`;
    }
    for (const r of load("update__ledgers")) await tx`update ledgers set opening_balance=${r.opening_balance}, current_balance=${r.current_balance}, debit_total=${r.debit_total}, credit_total=${r.credit_total} where id=${r.id}`;
    for (const r of load("update__enterprise_accounts")) await tx`update enterprise_accounts set current_balance=${r.current_balance} where id=${r.id}`;
    for (const r of load("update__transaction_serial_sequences")) await tx`update transaction_serial_sequences set next_value=${r.next_value} where id=${r.id}`;
    for (const f of manifest.files.filter((x: any) => x.name.startsWith("fixup__"))) {
      const [, table, col] = f.name.split("__");
      for (const r of load(f.name)) await tx.unsafe(`update public."${table}" set "${col}" = $1 where id = $2`, [r[col], r.id]);
    }
  });
  console.log("restored from", dir);
});
process.exit(0);
