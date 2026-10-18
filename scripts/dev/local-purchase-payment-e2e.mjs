/**
 * DEV only — Local Purchase credit/remaining payments (USD bill in an AED country, paid in AED / USD).
 *   BASE=http://localhost:3510 node scripts/dev/local-purchase-payment-e2e.mjs
 * Clones a real DEV local purchase (USD 2,500 @ 3.6725) into a throw-away credit bill and drives the REAL payments route.
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
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 230) : ""); };
const near = (a, b, e = 0.011) => Math.abs(Number(a) - Number(b)) <= e;
const r0 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const cookie = r0.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
const post = async (id, body, key = crypto.randomUUID()) => { const x = await fetch(`${BASE}/api/erp/purchases/orders/${id}/payments`, { method: "POST", headers: { cookie, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) }); let j = null; try { j = await x.json(); } catch {} return { status: x.status, j, msg: j?.error?.message || j?.message || "" }; };

const [src] = await sql`select lp.* from local_purchases lp join countries c on c.id = lp.country_id where lp.deleted_at is null and lp.purchase_currency = 'USD' and c.currency_code = 'AED' and coalesce(lp.final_cost, lp.purchase_cost, 0) > 0 order by lp.created_at desc limit 1`;
if (!src) throw new Error("no USD local purchase in an AED country on DEV");
const RATE = Number(src.exchange_rate || 3.6725);
const id = crypto.randomUUID();
const clone = { ...src, id, manual_bill_no: "E2ELP-" + String(Date.now()).slice(-6), payment_mode: "Credit", advance_amount: 0, remaining_balance: 2500, final_cost: 2500, purchase_cost: 2500, created_at: new Date(), updated_at: new Date() };
for (const k of Object.keys(clone)) if (clone[k] === undefined || /serial/i.test(k)) delete clone[k];
await sql`insert into local_purchases ${sql(clone)}`;
const [payable] = await sql`select id from ledgers where code = 'LOADTEST-AE-PAYABLE' limit 1`;
const [bank] = await sql`select id from ledgers where code = 'LOADTEST-AE-BANK' limit 1`;
const rem = async () => Number((await sql`select remaining_balance::float r from local_purchases where id = ${id}`)[0].r);
const count = async () => (await sql`select count(*)::int n from purchase_order_payments where local_purchase_id = ${id} and deleted_at is null`)[0].n;
const mk = (usd, extra = {}) => ({ kind: "remaining", entryDate: new Date().toISOString().slice(0, 10), amount: Math.round(usd * RATE * 100) / 100, currencyCode: "AED", exchangeRate: RATE, debitLedgerId: payable.id, creditLedgerId: bank.id, referenceNo: `E2ELP-${Math.random().toString(36).slice(2, 8)}`, ...extra });
try {
  check("bill starts at USD 2,500 outstanding", near(await rem(), 2500));
  const p1 = await post(id, mk(1000));
  check("AED payment equal to USD 1,000 posts", p1.status < 300, `${p1.status} ${p1.msg}`);
  check("outstanding falls by USD 1,000 (not by the AED figure)", near(await rem(), 1500, 0.02), `remaining ${await rem()}`);
  const over = await post(id, mk(1500.5));
  check("overpayment is rejected and changes nothing", over.status >= 400 && near(await rem(), 1500, 0.02) && (await count()) === 1, `${over.status} ${over.msg}`);
  const p2 = await post(id, { ...mk(0), amount: 500, currencyCode: "USD", exchangeRate: RATE });
  check("partial payment in USD posts", p2.status < 300 && near(await rem(), 1000, 0.02), `${p2.status} remaining ${await rem()} ${p2.msg}`);
  const key = crypto.randomUUID(); const b = mk(100);
  const a1 = await post(id, b, key); const a2 = await post(id, b, key);
  check("same Idempotency-Key replay posts once", a1.status < 300 && (await count()) === 3, `${a1.status}/${a2.status} count ${await count()}`);
  const left = await rem();
  const exact = await post(id, mk(left));
  check("exact outstanding balance posts", exact.status < 300 && near(await rem(), 0, 0.03), `${exact.status} ${exact.msg} remaining ${await rem()}`);
  const again = await post(id, mk(1));
  check("nothing more can be posted once settled", again.status >= 400, `${again.status} ${again.msg}`);
  const lines = await sql`select e.id, sum(l.debit)::float d, sum(l.credit)::float c from purchase_order_payments p join roznamcha_entries e on e.id = p.roznamcha_entry_id join roznamcha_lines l on l.roznamcha_entry_id = e.id where p.local_purchase_id = ${id} and p.deleted_at is null group by e.id`;
  check("every voucher's journal is balanced (DR = CR) and one per payment", lines.length === (await count()) && lines.every((x) => near(x.d, x.c, 0.01)), `${lines.length} journals / ${await count()} payments`);
} catch (e) { fail++; console.log("FATAL", e?.stack || e); }
finally {
  await sql`update local_purchases set deleted_at = now() where id = ${id}`.catch(() => {});
  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end({ timeout: 5 });
  process.exit(fail ? 1 : 0);
}
