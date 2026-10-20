/**
 * DEV only — simultaneous Purchase Order remaining payments can never together exceed the payable balance.
 *   BASE=http://localhost:3520 node scripts/dev/purchase-payment-race-e2e.mjs
 * Clones the real UAT order AE-001-0022 (USD 220,500 @ 3.675) and fires 4 simultaneous USD 100,000 payments (AED 367,500 each).
 * Contract: the order is NEVER over-paid (at most two can fit), at least one posts, refusals are clean 409s (cannot exceed / order busy), never a 500, vouchers balanced.
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
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 220) : ""); };
const near = (a, b, e = 0.011) => Math.abs(Number(a) - Number(b)) <= e;
const r0 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const cookie = r0.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
const post = async (poId, body, key = crypto.randomUUID()) => {
  const x = await fetch(`${BASE}/api/erp/purchases/orders/${poId}/payments`, { method: "POST", headers: { cookie, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) });
  let j = null; try { j = await x.json(); } catch {}
  return { status: x.status, msg: j?.error?.message || j?.message || "" };
};
const [src] = await sql`select * from purchase_orders where purchase_order_no = 'AE-001-0022' and deleted_at is null limit 1`;
if (!src) throw new Error("AE-001-0022 not found in DEV");
const id = crypto.randomUUID(), no = "E2ERACE-" + String(Date.now()).slice(-6);
const clone = { ...src, id, purchase_order_no: no, advance_paid: 0, remaining_paid: 0, credit_amount: 0, remaining_due: 220500, created_at: new Date(), updated_at: new Date() };
for (const k of Object.keys(clone)) if (clone[k] === undefined || /serial/i.test(k)) delete clone[k];
await sql`insert into purchase_orders ${sql(clone)}`;
const [payable] = await sql`select id from ledgers where code = 'LOADTEST-AE-PAYABLE' limit 1`;
const [bank] = await sql`select id from ledgers where code = 'LOADTEST-AE-BANK' limit 1`;
const due = async () => Number((await sql`select remaining_due::float d from purchase_orders where id = ${id}`)[0].d);
const count = async () => (await sql`select count(*)::int n from purchase_order_payments where purchase_order_id = ${id} and deleted_at is null`)[0].n;
const mk = () => ({ kind: "remaining", entryDate: new Date().toISOString().slice(0, 10), amount: 367500, currencyCode: "AED", exchangeRate: 3.675, debitLedgerId: payable.id, creditLedgerId: bank.id, referenceNo: `${no}-${Math.random().toString(36).slice(2, 7)}` });
try {
  const res = await Promise.all([post(id, mk()), post(id, mk()), post(id, mk()), post(id, mk())]);
  const ok = res.filter((r) => r.status < 300).length;
  console.log("INFO race:", res.map((r) => r.status + ":" + String(r.msg).slice(0, 90)).join(" | "), "remaining:", await due(), "payments:", await count());
  const left = await due();
  check("never over-paid: at most two of the four USD 100,000 payments post and at least one does", ok >= 1 && ok <= 2 && (await count()) === ok, `ok=${ok} payments=${await count()}`);
  check("remaining payable equals 220,500 minus what posted (never below 20,500)", left >= 20500 - 0.011 && near(left, 220500 - 100000 * ok), String(left));
  check("the refused ones are clean conflicts (409), never a 500", res.filter((r) => r.status >= 300).every((r) => r.status === 409 || r.status === 400 || r.status === 403), res.map((r) => r.status).join(","));
  const lines = await sql`select e.id, sum(l.debit)::float d, sum(l.credit)::float c from purchase_order_payments p join roznamcha_entries e on e.id = p.roznamcha_entry_id join roznamcha_lines l on l.roznamcha_entry_id = e.id where p.purchase_order_id = ${id} and p.deleted_at is null group by e.id`;
  check("every voucher is balanced (DR = CR), one per payment", lines.length === (await count()) && lines.every((x) => near(x.d, x.c, 0.01)), `${lines.length}/${await count()}`);
} catch (e) { fail++; console.log("FATAL", e?.stack || e); }
finally {
  await sql`update purchase_orders set deleted_at = now() where id = ${id}`.catch(() => {});
  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end({ timeout: 5 });
  process.exit(fail ? 1 : 0);
}
