/**
 * DEV only — Purchase Booking → Roznamcha / Ledger transfer: exactly-once posting.
 *   BASE=http://localhost:3510 node scripts/dev/purchase-transfer-e2e.mjs
 * Clones the real UAT order AE-001-0022 (USD 220,500 @ 3.675) into a throw-away UNPOSTED DEV order and drives the REAL transfer route.
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
const transfer = async (id, key) => { const h = { cookie, "content-type": "application/json" }; if (key) h["idempotency-key"] = key; const x = await fetch(`${BASE}/api/erp/purchases/orders/${id}/transfer`, { method: "POST", headers: h, body: JSON.stringify({ paymentType: "Advance Payment" }) }); let j = null; try { j = await x.json(); } catch {} return { status: x.status, ok: !!j?.ok, msg: j?.error?.message || j?.message || "" }; };

const [src] = await sql`select * from purchase_orders where purchase_order_no = 'AE-001-0022' and deleted_at is null limit 1`;
if (!src) throw new Error("AE-001-0022 not found in DEV");
const mkOrder = async () => {
  const id = crypto.randomUUID(), no = "E2ETRF-" + String(Date.now()).slice(-6) + Math.floor(Math.random() * 90 + 10);
  const clone = { ...src, id, purchase_order_no: no, order_total: Math.round(Number(src.total_goods_original || 220500) * Number(src.exchange_rate || 3.675) * 100) / 100, ledger_posting_status: "unposted", payment_status: "unpaid", is_edited_since_transfer: false, advance_paid: 0, remaining_paid: 0, credit_amount: 0, remaining_due: 220500, created_at: new Date(), updated_at: new Date() };
  for (const k of Object.keys(clone)) if (clone[k] === undefined || /serial/i.test(k)) delete clone[k];
  await sql`insert into purchase_orders ${sql(clone)}`;
  return { id, no };
};
const state = async (id) => {
  const pays = await sql`select id, amount::float a, base_currency_amount::float b, debit_ledger_id d, credit_ledger_id c, roznamcha_entry_id e from purchase_order_payments where purchase_order_id = ${id} and kind = 'booking' and deleted_at is null`;
  const o = (await sql`select ledger_posting_status s from purchase_orders where id = ${id}`)[0];
  const lines = pays.length ? await sql`select sum(debit)::float d, sum(credit)::float c from roznamcha_lines where roznamcha_entry_id = any(${pays.map((p) => p.e)}::uuid[])` : [{ d: 0, c: 0 }];
  return { pays, status: o.s, dr: lines[0].d, cr: lines[0].c };
};
const created = [];
try {
  // 1) two simultaneous clicks WITHOUT an idempotency key (what the UI sends today)
  const a = await mkOrder(); created.push(a.id);
  const [t1, t2] = await Promise.all([transfer(a.id), transfer(a.id)]);
  let s = await state(a.id);
  console.log("INFO simultaneous:", t1.status, t2.status, "payments:", s.pays.length, "status:", s.status);
  check("two simultaneous transfers (no key) post exactly ONE booking payment", s.pays.length === 1, `payments=${s.pays.length} [${t1.status}/${t2.status}] ${t1.msg || t2.msg}`);
  check("every simultaneous request ends cleanly (success, or a clear 409) — never a 500", [t1, t2].every((t) => t.ok || t.status === 409), `${t1.status}/${t2.status} ${t1.msg} ${t2.msg}`);
  check("journal is balanced and equals AED 810,337.50 once (no double conversion)", near(s.dr, s.cr, 0.01) && near(s.dr, 810337.5, 1) , `DR ${s.dr} CR ${s.cr}`);
  check("order is marked posted", s.status === "posted", s.status);
  // 2) a later click on the same order
  const again = await transfer(a.id);
  s = await state(a.id);
  check("a repeat transfer of a posted order posts nothing (refused or idempotent)", s.pays.length === 1 && (again.ok || again.status === 409), `${again.status} ${again.msg}`);

  // 3) same idempotency key replayed
  const b = await mkOrder(); created.push(b.id);
  const key = "e2e-" + crypto.randomUUID();
  const k1 = await transfer(b.id, key); const k2 = await transfer(b.id, key);
  s = await state(b.id);
  check("replay with the same Idempotency-Key posts once", k1.ok && s.pays.length === 1, `${k1.status}/${k2.status} payments=${s.pays.length}`);

  // 4) interrupted earlier transfer (payment exists, order still unposted) is reconciled, not double-posted
  const c = await mkOrder(); created.push(c.id);
  const c1 = await transfer(c.id);
  await sql`update purchase_orders set ledger_posting_status = 'unposted', payment_status = 'unpaid' where id = ${c.id}`;
  const c2 = await transfer(c.id);
  s = await state(c.id);
  check("interrupted transfer is reconciled (no second posting)", c1.ok && c2.ok && s.pays.length === 1 && s.status === "posted", `${c1.status}/${c2.status} payments=${s.pays.length} ${c2.msg}`);

  // 5) hard DB guarantee: a second booking payment row cannot be inserted for the same order
  let dbBlocked = false;
  try {
    const p = (await state(c.id)).pays[0];
    await sql`insert into purchase_order_payments (purchase_order_id, kind, amount, currency_code, exchange_rate, debit_ledger_id, credit_ledger_id, status, entry_date)
              select purchase_order_id, kind, amount, currency_code, exchange_rate, debit_ledger_id, credit_ledger_id, status, entry_date from purchase_order_payments where id = ${p.id}`;
  } catch (e) { dbBlocked = /unique|duplicate/i.test(String(e)); }
  s = await state(c.id);
  check("database refuses a second live booking payment for the same order", dbBlocked && s.pays.length === 1, `payments=${s.pays.length}`);
  if (!dbBlocked) await sql`delete from purchase_order_payments where purchase_order_id = ${c.id} and id <> ${s.pays[0].id}`.catch(() => {});
} catch (e) {
  fail++; console.log("FATAL", e?.stack || e);
} finally {
  for (const id of created) await sql`update purchase_orders set deleted_at = now() where id = ${id}`.catch(() => {});
  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end({ timeout: 5 });
  process.exit(fail ? 1 : 0);
}
