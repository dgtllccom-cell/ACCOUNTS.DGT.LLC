/**
 * DEV only — Advance + Credit payment kinds for PURCHASE orders and Advance receipts for SALES orders (the Endorsement page posts as kind "advance").
 *   BASE=http://localhost:3520 node scripts/dev/payment-kinds-e2e.mjs
 * Purchase: clones AE-001-0022 (USD 220,500 @ 3.675) with a 30% advance rule. Sales: clones a PKR sales order (14,000) with a 30% advance rule.
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
const near = (a, b, e = 0.02) => Math.abs(Number(a) - Number(b)) <= e;
const r0 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const cookie = r0.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
const post = async (path, body, key = crypto.randomUUID()) => {
  const x = await fetch(BASE + path, { method: "POST", headers: { cookie, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) });
  let j = null; try { j = await x.json(); } catch {}
  return { status: x.status, msg: j?.error?.message || j?.message || "" };
};
const ids = { po: null, so: null };
try {
  // ───────────── PURCHASE ─────────────
  const [src] = await sql`select * from purchase_orders where purchase_order_no = 'AE-001-0022' and deleted_at is null limit 1`;
  if (!src) throw new Error("AE-001-0022 not found in DEV");
  const poId = crypto.randomUUID(); ids.po = poId; const no = "E2EKIND-" + String(Date.now()).slice(-6);
  const clone = { ...src, id: poId, purchase_order_no: no, advance_paid: 0, remaining_paid: 0, credit_amount: 0, remaining_due: 220500, created_at: new Date(), updated_at: new Date() };
  for (const k of Object.keys(clone)) if (clone[k] === undefined || /serial/i.test(k)) delete clone[k];
  const fd = JSON.parse(JSON.stringify(src.form_data || {})); fd.form = { ...(fd.form || {}), advancePercent: 30, endorsementPercent: 30 };
  clone.form_data = sql.json(fd);
  await sql`insert into purchase_orders ${sql(clone)}`;
  const [payable] = await sql`select id from ledgers where code = 'LOADTEST-AE-PAYABLE' limit 1`;
  const [bank] = await sql`select id from ledgers where code = 'LOADTEST-AE-BANK' limit 1`;
  const RATE = 3.675;
  const due = async () => Number((await sql`select remaining_due::float d from purchase_orders where id = ${poId}`)[0].d);
  const cnt = async () => (await sql`select count(*)::int n from purchase_order_payments where purchase_order_id = ${poId} and deleted_at is null`)[0].n;
  const mk = (kind, usd) => ({ kind, entryDate: new Date().toISOString().slice(0, 10), amount: Math.round(usd * RATE * 100) / 100, currencyCode: "AED", exchangeRate: RATE, debitLedgerId: payable.id, creditLedgerId: bank.id, referenceNo: `${no}-${Math.random().toString(36).slice(2, 7)}` });
  const P = `/api/erp/purchases/orders/${poId}/payments`;
  const a1 = await post(P, mk("advance", 60000));
  check("PURCHASE advance USD 60,000 (AED) posts", a1.status < 300, `${a1.status} ${a1.msg}`);
  check("remaining payable falls to 160,500", near(await due(), 160500), String(await due()));
  const aOver = await post(P, mk("advance", 170000));
  check("an advance larger than the whole remaining balance is refused (409)", aOver.status === 409 && (await cnt()) === 1, `${aOver.status} ${aOver.msg}`);
  const c1 = await post(P, mk("credit", 100000));
  check("PURCHASE credit payment USD 100,000 posts", c1.status < 300, `${c1.status} ${c1.msg}`);
  check("remaining payable falls to 60,500", near(await due(), 60500), String(await due()));
  const cOver = await post(P, mk("credit", 60500.5));
  check("credit overpayment is refused (409)", cOver.status === 409 && (await cnt()) === 2, `${cOver.status} ${cOver.msg}`);
  const rest = await post(P, mk("credit", 60500));
  check("exact remaining balance posts and leaves ZERO", rest.status < 300 && near(await due(), 0), `${rest.status} ${rest.msg} due=${await due()}`);
  const adv2 = await post(P, mk("advance", 1));
  const cr2 = await post(P, mk("credit", 1));
  check("a fully paid order refuses advance AND credit (no re-opening)", adv2.status >= 400 && cr2.status >= 400 && (await cnt()) === 3, `${adv2.status}/${cr2.status}`);
  const lines = await sql`select e.id, sum(l.debit)::float d, sum(l.credit)::float c from purchase_order_payments p join roznamcha_entries e on e.id = p.roznamcha_entry_id join roznamcha_lines l on l.roznamcha_entry_id = e.id where p.purchase_order_id = ${poId} and p.deleted_at is null group by e.id`;
  check("PURCHASE: every voucher balanced (DR = CR), one per payment", lines.length === (await cnt()) && lines.every((x) => near(x.d, x.c, 0.01)), `${lines.length}/${await cnt()}`);

  // ───────────── SALES ─────────────
  const [ssrc] = await sql`select * from sales_orders where deleted_at is null and currency_code = 'PKR' and customer_account_id is not null
    and coalesce(form_data->'form'->>'salesAccountLedgerId','') <> '' order by created_at desc limit 1`;
  if (!ssrc) throw new Error("no PKR DEV sales order");
  const soId = crypto.randomUUID(); ids.so = soId; const TOTAL = 14000;
  const sc = { ...ssrc, id: soId, sales_order_no: "E2EKINDS-" + Math.random().toString(36).slice(2, 7).toUpperCase(), order_total: TOTAL, total_goods_original: TOTAL, paid_amount: 0, remaining_amount: TOTAL, payment_status: "pending", exchange_rate: 1, ledger_posting_status: "transferred", is_edited_since_transfer: false, created_at: new Date(), updated_at: new Date() };
  for (const k of Object.keys(sc)) if (sc[k] === undefined || /serial/i.test(k) || k === "sales_contract_no") delete sc[k];
  const sfd = JSON.parse(JSON.stringify(ssrc.form_data || {})); sfd.form = { ...(sfd.form || {}), advancePercent: 30, exchangeRate: 1 };
  if (Array.isArray(sfd.goodsEntries)) for (const g of sfd.goodsEntries) { delete g.managedLotId; g.totalAmount = TOTAL / sfd.goodsEntries.length; }
  sc.form_data = sql.json(sfd);
  await sql`insert into sales_orders ${sql(sc)}`;
  const ledgerOf = async (acct) => (await sql`select id from ledgers where enterprise_account_id = ${acct}::uuid and deleted_at is null limit 1`)[0]?.id;
  const dr = await ledgerOf(sfd.form.salesAccountLedgerId), cr = await ledgerOf(sc.customer_account_id);
  const srow = async () => (await sql`select paid_amount::float p, remaining_amount::float r from sales_orders where id = ${soId}`)[0];
  const scount = async () => (await sql`select count(*)::int n from sales_order_payments where sales_order_id = ${soId} and deleted_at is null and status = 'posted'`)[0].n;
  const smk = (kind, amt) => ({ kind, entryDate: new Date().toISOString().slice(0, 10), amount: amt, currencyCode: "PKR", exchangeRate: 1, debitLedgerId: dr, creditLedgerId: cr, referenceNo: `E2EKS-${Math.random().toString(36).slice(2, 7)}` });
  const S = `/api/erp/sales/orders/${soId}/payments`;
  const s1 = await post(S, smk("advance", 3000));
  check("SALES advance receipt PKR 3,000 (of required 4,200) posts", s1.status < 300 && near((await srow()).p, 3000), `${s1.status} ${s1.msg} ${JSON.stringify(await srow())}`);
  const s2 = await post(S, smk("advance", 1500));
  check("an advance above the remaining REQUIRED advance (1,200) is refused (409)", s2.status === 409 && (await scount()) === 1, `${s2.status} ${s2.msg}`);
  const s3 = await post(S, smk("advance", 1200));
  check("the exact remaining advance posts", s3.status < 300 && near((await srow()).p, 4200), `${s3.status} ${s3.msg} ${JSON.stringify(await srow())}`);
  const s4 = await post(S, smk("advance", 100));
  check("a further advance is refused: already fully received (409)", s4.status === 409 && (await scount()) === 2, `${s4.status} ${s4.msg}`);
  const s5 = await post(S, smk("credit", 9800));
  check("SALES credit receipt of the remaining 9,800 posts and leaves ZERO", s5.status < 300 && near((await srow()).r, 0), `${s5.status} ${s5.msg} ${JSON.stringify(await srow())}`);
  const s6 = await post(S, smk("credit", 1));
  check("a fully received order refuses more (409)", s6.status === 409 && (await scount()) === 3, `${s6.status} ${s6.msg}`);
  const slines = await sql`select e.id, sum(l.debit)::float d, sum(l.credit)::float c from sales_order_payments p join roznamcha_entries e on e.id = p.roznamcha_entry_id join roznamcha_lines l on l.roznamcha_entry_id = e.id where p.sales_order_id = ${soId} and p.deleted_at is null group by e.id`;
  check("SALES: every voucher balanced (DR = CR), one per receipt", slines.length === (await scount()) && slines.every((x) => near(x.d, x.c, 0.01)), `${slines.length}/${await scount()}`);
} catch (e) { fail++; console.log("FATAL", e?.stack || e); }
finally {
  if (ids.po) await sql`update purchase_orders set deleted_at = now() where id = ${ids.po}`.catch(() => {});
  if (ids.so) await sql`update sales_orders set deleted_at = now() where id = ${ids.so}`.catch(() => {});
  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end({ timeout: 5 });
  process.exit(fail ? 1 : 0);
}
