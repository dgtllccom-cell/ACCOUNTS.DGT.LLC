/**
 * DEV only — Purchase Order Remaining Payment posting (USD order in an AED country, paid in AED / USD).
 *   BASE=http://localhost:3510 node scripts/dev/payment-remaining-e2e.mjs
 * Clones the real UAT purchase order AE-001-0022 (USD 220,500 @ 3.675) into a throw-away DEV order and drives the REAL payments route.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import postgres from "postgres";
const BASE = process.env.BASE || "http://localhost:3510"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
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
const post = async (poId, body, key = crypto.randomUUID()) => { const x = await fetch(`${BASE}/api/erp/purchases/orders/${poId}/payments`, { method: "POST", headers: { cookie, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) }); let j = null; try { j = await x.json(); } catch {} return { status: x.status, j, msg: j?.error?.message || j?.message || "" }; };

// ── throw-away clone of the real UAT order ──
const [src] = await sql`select * from purchase_orders where purchase_order_no = 'AE-001-0022' and deleted_at is null limit 1`;
if (!src) throw new Error("AE-001-0022 not found in DEV");
const id = crypto.randomUUID(), no = "E2EPAY-" + String(Date.now()).slice(-6);
const clone = { ...src, id, purchase_order_no: no, advance_paid: 0, remaining_paid: 0, credit_amount: 0, remaining_due: 220500, created_at: new Date(), updated_at: new Date() };
for (const k of Object.keys(clone)) if (clone[k] === undefined || /serial/i.test(k)) delete clone[k];
await sql`insert into purchase_orders ${sql(clone)}`;
const [payable] = await sql`select id, code from ledgers where code = 'LOADTEST-AE-PAYABLE' limit 1`;
const [bank] = await sql`select id, code from ledgers where code = 'LOADTEST-AE-BANK' limit 1`;
const RATE = 3.675;
const due = async () => Number((await sql`select remaining_due::float as d from purchase_orders where id = ${id}`)[0].d);
const mk = (usd, extra = {}) => ({ kind: "remaining", entryDate: new Date().toISOString().slice(0, 10), amount: Math.round(usd * RATE * 100) / 100, currencyCode: "AED", exchangeRate: RATE, debitLedgerId: payable.id, creditLedgerId: bank.id, referenceNo: `${no}-${Math.random().toString(36).slice(2, 7)}`, ...extra });
const paymentsCount = async () => (await sql`select count(*)::int n from purchase_order_payments where purchase_order_id = ${id} and deleted_at is null`)[0].n;

try {
  check("order starts at USD 220,500 remaining", near(await due(), 220500));

  // 1. the reported failure: pay in AED (local amount = USD × 3.675)
  const p1 = await post(id, mk(100_000));
  check("AED payment equal to USD 100,000 posts (was rejected as 'cannot exceed')", p1.status < 300, `${p1.status} ${p1.msg}`);
  const d1 = await due();
  check("remaining payable falls by USD 100,000 (not ×3.675)", near(d1, 120500, 1), `remaining ${d1}`);
  const pay1 = (await sql`select amount::float a, currency_code c, base_currency_amount::float b, debit_ledger_id, credit_ledger_id from purchase_order_payments where purchase_order_id = ${id} and deleted_at is null order by created_at limit 1`)[0];
  check("payment row stores AED 367,500 with the chosen DR / CR ledgers", pay1 && near(pay1.b, 367500, 0.05) && pay1.debit_ledger_id === payable.id && pay1.credit_ledger_id === bank.id, JSON.stringify(pay1));

  // 2. overpayment still rejected (even by a tiny margin)
  const over = await post(id, mk(120500.5));
  check("overpayment of USD 0.50 is rejected", over.status >= 400 && /cannot exceed/i.test(over.msg), `${over.status} ${over.msg}`);
  const over2 = await post(id, mk(500_000));
  check("large overpayment is rejected", over2.status >= 400 && /cannot exceed/i.test(over2.msg), `${over2.status}`);
  check("rejected payments created nothing", (await paymentsCount()) === 1, String(await paymentsCount()));

  // 3. a forged rate cannot hide an overpayment
  const forged = await post(id, { ...mk(500_000), exchangeRate: 1000 });
  check("forged exchange rate cannot bypass the overpayment check", forged.status >= 400, `${forged.status} ${forged.msg}`);

  // 4. partial payment in USD (order currency)
  const p2 = await post(id, { ...mk(0), amount: 20_000, currencyCode: "USD", exchangeRate: RATE });
  check("partial payment in USD posts", p2.status < 300, `${p2.status} ${p2.msg}`);
  check("remaining 100,500 after USD 20,000", near(await due(), 100500, 1), String(await due()));

  // 5. same request replayed (same idempotency key) does not duplicate
  const key = crypto.randomUUID(); const body = mk(500);
  const a = await post(id, body, key); const b = await post(id, body, key);
  check("replay with the same key posts once", a.status < 300 && b.status < 300 && (await paymentsCount()) === 3, `count ${await paymentsCount()}`);

  // 6. exact-balance payment in AED, then nothing left
  const left = await due();
  const exact = await post(id, mk(left));
  check("exact remaining balance posts", exact.status < 300, `${exact.status} ${exact.msg} left=${left}`);
  check("remaining payable is zero", near(await due(), 0, 0.02), String(await due()));
  const again = await post(id, mk(1));
  check("no further payment once fully paid", again.status >= 400, `${again.status} ${again.msg}`);

  // 7. ledger entries balanced (DR == CR) for every posted payment
  const lines = await sql`select e.id, sum(l.debit)::float d, sum(l.credit)::float c from purchase_order_payments p join roznamcha_entries e on e.id = p.roznamcha_entry_id join roznamcha_lines l on l.roznamcha_entry_id = e.id where p.purchase_order_id = ${id} and p.deleted_at is null group by e.id`;
  check("every voucher's journal is balanced (DR = CR)", lines.length >= 4 && lines.every((x) => near(x.d, x.c, 0.01)), `${lines.length} vouchers`);
} catch (e) {
  fail++; console.log("FATAL", e?.stack || e);
} finally {
  await sql`update purchase_orders set deleted_at = now() where id = ${id}`.catch(() => {});
  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end({ timeout: 5 });
  process.exit(fail ? 1 : 0);
}
