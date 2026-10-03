/**
 * DEV-ONLY transactional cleanup (owner decision 2026-10-04: remove ALL DEV transactions, keep ALL master data).
 *
 *   --plan      (default) read-only: counts per table, FK fix-ups that would be needed, sequences that would reset
 *   --backup    write a full row-level JSON backup of every table/row the run will touch (+ manifest with sha256)
 *   --execute   backup, then ONE transaction: delete children→parents, null NO-ACTION references from kept tables,
 *               reset derived balances + transactional serial counters, verify in-transaction, COMMIT only if verified.
 *
 * Refuses to run against anything but the DEV project (csesvyxxjivnkkozgopt). Never TRUNCATE, never a schema reset.
 * Restore: scripts/dev-transaction-restore.mts <backupDir> (re-inserts the JSON rows parents→children).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { withLocalPg, getDbUrl } from "@/lib/db/local-postgres";

if (!getDbUrl().includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing: this is not the DEV database.");
const MODE = process.argv.includes("--execute") ? "execute" : process.argv.includes("--backup") ? "backup" : "plan";
const BACKUP_ROOT = process.env.BACKUP_ROOT || "B:/accounts.dgt.llc.code_project/db-backups";

import { DELETE_ORDER } from "./dev-transaction-cleanup-order";

/** Serial counters of TRANSACTION documents (restart at 1). Master counters (account, goods, person, products, truck…) are kept. */
const TX_SEQUENCE = /^(journal_roznamcha|roznamcha|roznamcha_credit|roznamcha_debit|loading|payment_purchase|payment_sales|purchase|sales|truck_loading|import_truck_loading|stress_test_doc|test_entity|bill|bill_expense|clearing_order|customer_order|order|receipt|settlement|exchange|money_exchange|local_purchase|cash|voucher|invoice|transfer|transit|consignment|bl|lane|clearing_customer_orders|clearing_customer_bills)$/;

type Row = Record<string, unknown>;
const exists = async (sql: any, t: string) => (await sql`select to_regclass(${"public." + t}) r`)[0].r !== null;

await withLocalPg(async (sql) => {
  const tables = [] as { t: string; n: number }[];
  for (const t of DELETE_ORDER) if (await exists(sql, t)) tables.push({ t, n: (await sql.unsafe(`select count(*)::int n from public."${t}"`))[0].n });
  const set = new Set(tables.map((x) => x.t));

  // NO ACTION / RESTRICT references from KEPT tables into the delete set → must be nulled (or the plan is unsafe)
  const fks = await sql`select conrelid::regclass::text child, confrelid::regclass::text parent, confdeltype, (select array_agg(a.attname) from unnest(conkey) k join pg_attribute a on a.attrelid=conrelid and a.attnum=k) cols, conname from pg_constraint where contype='f' and connamespace='public'::regnamespace`;
  const fixups: { child: string; col: string; parent: string; rows: number; nullable: boolean; action: string }[] = [];
  for (const f of fks as any[]) {
    const child = f.child.replace(/"/g, ""), parent = f.parent.replace(/"/g, "");
    if (!set.has(parent) || set.has(child)) continue;
    for (const col of f.cols) {
      const [{ n }] = await sql.unsafe(`select count(*)::int n from public."${child}" where "${col}" is not null`);
      if (!n) continue;
      const [{ nullable }] = await sql`select is_nullable='YES' nullable from information_schema.columns where table_schema='public' and table_name=${child} and column_name=${col}`;
      fixups.push({ child, col, parent, rows: n, nullable, action: f.confdeltype === "n" ? "db SET NULL" : f.confdeltype === "c" ? "db CASCADE (!)" : "explicit SET NULL" });
    }
  }
  const seqs = (await sql`select entity_type, scope_type, scope_key, prefix, next_value from transaction_serial_sequences order by 1`) as Row[];
  const seqReset = seqs.filter((s) => TX_SEQUENCE.test(String(s.entity_type)));
  const seqKept = [...new Set(seqs.filter((s) => !TX_SEQUENCE.test(String(s.entity_type))).map((s) => s.entity_type))];

  const plan = { at: new Date().toISOString(), db: "csesvyxxjivnkkozgopt (DEV)", tables, totalRows: tables.reduce((a, x) => a + x.n, 0), fixups, sequencesReset: seqReset.length, sequenceTypesReset: [...new Set(seqReset.map((s) => s.entity_type))], sequenceTypesKept: seqKept };
  console.log(JSON.stringify({ ...plan, tables: tables.filter((x) => x.n > 0) }, null, 1));
  if (fixups.some((f) => f.action === "explicit SET NULL" && !f.nullable)) throw new Error("A kept table holds a NOT NULL reference into the delete set — plan is unsafe.");
  if (fixups.some((f) => f.action.startsWith("db CASCADE"))) throw new Error("A kept table would be cascade-deleted — plan is unsafe.");
  if (MODE === "plan") return;

  // ── backup: every row that will be deleted or changed ──
  const dir = path.join(BACKUP_ROOT, `dev-cleanup-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  fs.mkdirSync(dir, { recursive: true });
  const manifest: any = { ...plan, dir, files: [] as any[] };
  const dump = async (name: string, q: string) => {
    const rows = await sql.unsafe(q);
    const body = JSON.stringify(rows);
    fs.writeFileSync(path.join(dir, `${name}.json`), body);
    manifest.files.push({ name, rows: rows.length, sha256: crypto.createHash("sha256").update(body).digest("hex") });
  };
  for (const { t } of tables) await dump(t, `select * from public."${t}"`);
  for (const f of fixups) await dump(`fixup__${f.child}__${f.col}`, `select id, "${f.col}" from public."${f.child}" where "${f.col}" is not null`);
  await dump("update__ledgers", `select id, opening_balance, current_balance, debit_total, credit_total from public.ledgers`);
  await dump("update__enterprise_accounts", `select id, opening_balance, current_balance from public.enterprise_accounts`);
  await dump("update__transaction_serial_sequences", `select * from public.transaction_serial_sequences`);
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("BACKUP", dir, manifest.files.length, "files");
  if (MODE === "backup") return;

  // ── execute: one transaction, verified before commit ──
  const result: any = { backup: dir, deleted: {} as Record<string, number>, nulled: [] as any[] };
  await sql.begin(async (tx: any) => {
    for (const f of fixups.filter((x) => x.action === "explicit SET NULL")) {
      const r = await tx.unsafe(`update public."${f.child}" set "${f.col}" = null where "${f.col}" is not null`);
      result.nulled.push({ table: f.child, column: f.col, rows: r.count });
    }
    if (set.has("inter_country_transfers")) await tx.unsafe(`update public.inter_country_transfers set resubmitted_from_id = null where resubmitted_from_id is not null`);
    // repeat until every table is empty: AFTER DELETE triggers (bill-expense / UAE-tax sync) may write into tables already passed
    for (let pass = 1; pass <= 3; pass++) {
      for (const { t } of tables) {
        const r = await tx.unsafe(`delete from public."${t}"`);
        result.deleted[t] = (result.deleted[t] ?? 0) + r.count;
      }
      const left = [] as string[];
      for (const { t } of tables) if ((await tx.unsafe(`select count(*)::int n from public."${t}"`))[0].n) left.push(t);
      if (!left.length) break;
      if (pass === 3) throw new Error("rows re-created by triggers after 3 passes: " + left.join(","));
    }
    // masters reconcile to ZERO activity
    result.ledgers = (await tx.unsafe(`update public.ledgers set debit_total = 0, credit_total = 0, current_balance = coalesce(opening_balance, 0) where debit_total <> 0 or credit_total <> 0 or current_balance <> coalesce(opening_balance, 0)`)).count;
    result.accounts = (await tx.unsafe(`update public.enterprise_accounts set current_balance = coalesce(opening_balance, 0) where current_balance is distinct from coalesce(opening_balance, 0)`)).count;
    const ids = seqReset.map((s: any) => s.entity_type);
    result.sequences = (await tx`update public.transaction_serial_sequences set next_value = 1, updated_at = now() where entity_type = any(${ids}::text[])`).count;

    // in-transaction verification — any failure rolls everything back
    const v: any = {};
    for (const { t } of tables) v[t] = (await tx.unsafe(`select count(*)::int n from public."${t}"`))[0].n;
    const notEmpty = Object.entries(v).filter(([, n]) => n);
    const [led] = await tx.unsafe(`select count(*) filter (where debit_total<>0 or credit_total<>0 or current_balance<>coalesce(opening_balance,0))::int bad from public.ledgers`);
    const [acc] = await tx.unsafe(`select count(*) filter (where current_balance is distinct from coalesce(opening_balance,0))::int bad from public.enterprise_accounts`);
    if (notEmpty.length || led.bad || acc.bad) throw new Error("verification failed: " + JSON.stringify({ notEmpty, ledgers: led.bad, accounts: acc.bad }));
    result.verified = true;
  });
  fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify(result, null, 2));
  console.log("EXECUTED", JSON.stringify(result));
});
process.exit(0);
