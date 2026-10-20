/**
 * DEV only — Sales order receipts (kind remaining / credit / advance): partial, overpayment, simultaneous overpayment race, exact balance, zero afterwards, replay, DR=CR.
 *   BASE=http://localhost:3520 node scripts/dev/sales-payment-e2e.mjs
 * Clones a real DEV sales order (PKR, order currency = body currency) into a throw-away one and drives the REAL payments route.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import postgres from "postgres";
const BASE = process.env.BASE || "http://localhost:3520"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const env = {};
for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!url || url.includes("inmayhrxucimxqhgseqi") || !url.includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing: not the DEV database");
const sql = postgres(url, { max: 2, prepare: false, onnotice: () => {} });
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 230) : ""); };
const near = (a, b, e = 0.011) => Math.abs(Number(a) - Number(b)) <= e;
const r0 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const cookie = r0.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
const post = async (id, body, key = crypto.randomUUID()) => {
  const x = await fetch(`${BASE}/api/erp/sales/orders/${id}/payments`, { method: "POST", headers: { cookie, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) });
  let j = null; try { j = await x.json(); } catch {}
  return { status: x.status, j, msg: j?.error?.message || j?.message || "" };
};

const [src] = await sql`select * from sales_orders where deleted_at is null and currency_code = 'PKR' and customer_account_id is not null
  and coalesce(form_data->'form'->>'salesAccountLedgerId','') <> '' and coalesce(form_data->'form'->>'customerAccountLedgerId','') <> ''
  order by created_at desc limit 1`;
if (!src) throw new Error("no PKR DEV sales order to clone");
const TOTAL = 14000;
const id = crypto.randomUUID();
const clone = { ...src, id, sales_order_no: "E2ESPAY-" + Math.random().toString(36).slice(2, 8).toUpperCase(), order_total: TOTAL, total_goods_original: TOTAL, paid_amount: 0, remaining_amount: TOTAL, payment_status: "pending", exchange_rate: 1, ledger_posting_status: "transferred", is_edited_since_transfer: false, created_at: new Date(), updated_at: new Date() };
for (const k of Object.keys(clone)) if (clone[k] === undefined || /serial/i.test(k) || k === "sales_contract_no") delete clone[k];
const fd = JSON.parse(JSON.stringify(src.form_data || {})); fd.form = { ...(fd.form || {}), advancePercent: 0, exchangeRate: 1 };
if (Array.isArray(fd.goodsEntries)) for (const g of fd.goodsEntries) { delete g.managedLotId; g.totalAmount = TOTAL / fd.goodsEntries.length; }
clone.form_data = sql.json(fd);
await sql`insert into sales_orders ${sql(clone)}`;
// the wizard stores enterprise_accounts ids in the *LedgerId fields; the real ledgers row is linked 1:1 via ledgers.enterprise_account_id
const ledgerOf = async (acct) => (await sql`select id from ledgers where enterprise_account_id = ${acct}::uuid and deleted_at is null limit 1`)[0]?.id;
const dr = await ledgerOf(fd.form.salesAccountLedgerId), cr = await ledgerOf(clone.customer_account_id);
if (!dr || !cr || dr === cr) throw new Error("could not resolve two distinct ledgers for the cloned order");
const row = async () => (await sql`select paid_amount::float p, remaining_amount::float r, payment_status s from sales_orders where id = ${id}`)[0];
const count = async () => (await sql`select count(*)::int n from sales_order_payments where sales_order_id = ${id} and deleted_at is null and status = 'posted'`)[0].n;
const mk = (amt, extra = {}) => ({ kind: "remaining", entryDate: new Date().toISOString().slice(0, 10), amount: amt, currencyCode: "PKR", exchangeRate: 1, debitLedgerId: dr, creditLedgerId: cr, referenceNo: `E2ESPAY-${Math.random().toString(36).slice(2, 8)}`, ...extra });
try {
  check("order starts with PKR 14,000 receivable", near((await row()).r, TOTAL), JSON.stringify(await row()));
  const p1 = await post(id, mk(5000));
  check("partial receipt PKR 5,000 posts", p1.status < 300, `${p1.status} ${p1.msg}`);
  check("received 5,000 / remaining 9,000", near((await row()).p, 5000) && near((await row()).r, 9000), JSON.stringify(await row()));
  const over = await post(id, mk(9000.5));
  check("overpayment is refused and posts nothing", over.status >= 400 && (await count()) === 1, `${over.status} ${over.msg}`);
  // simultaneous receipts that together exceed the balance: only what fits may post
  const race = await Promise.all([post(id, mk(6000)), post(id, mk(6000)), post(id, mk(6000))]);
  const okN = race.filter((r) => r.status < 300).length;
  console.log("INFO race:", race.map((r) => r.status).join(" "), "row:", JSON.stringify(await row()));
  check("three simultaneous 6,000 receipts against 9,000 remaining: exactly one posts (never overpays)", okN === 1 && (await row()).r >= -0.01 && near((await row()).p, 11000), `ok=${okN} ${JSON.stringify(await row())}`);
  check("no 500 from the simultaneous receipts", race.every((r) => r.status < 500 || /cannot exceed|remaining/i.test(r.msg)), race.map((r) => r.status).join(","));
  const key = crypto.randomUUID(); const b = mk(1000);
  const a1 = await post(id, b, key); const a2 = await post(id, b, key);
  check("same Idempotency-Key replay posts once", a1.status < 300 && (await count()) === 3, `${a1.status}/${a2.status} count ${await count()}`);
  const left = (await row()).r;
  const exact = await post(id, mk(left));
  check("exact remaining balance posts", exact.status < 300 && near((await row()).r, 0, 0.02), `${exact.status} ${exact.msg} ${JSON.stringify(await row())}`);
  check("fully received order shows ZERO remaining and status paid", near((await row()).r, 0, 0.02) && /paid|complete/i.test((await row()).s), JSON.stringify(await row()));
  const again = await post(id, mk(1));
  check("nothing more can be received once settled", again.status >= 400 && (await count()) === 4, `${again.status} ${again.msg}`);
  const lines = await sql`select e.id, sum(l.debit)::float d, sum(l.credit)::float c from sales_order_payments p join roznamcha_entries e on e.id = p.roznamcha_entry_id join roznamcha_lines l on l.roznamcha_entry_id = e.id where p.sales_order_id = ${id} and p.deleted_at is null group by e.id`;
  check("every voucher's journal is balanced (DR = CR), one per receipt", lines.length === (await count()) && lines.every((x) => near(x.d, x.c, 0.01)), `${lines.length} journals / ${await count()} receipts`);
} catch (e) { fail++; console.log("FATAL", e?.stack || e); }
finally {
  await sql`update sales_orders set deleted_at = now() where id = ${id}`.catch(() => {});
  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end({ timeout: 5 });
  process.exit(fail ? 1 : 0);
}
