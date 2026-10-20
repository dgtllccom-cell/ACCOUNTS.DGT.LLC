/**
 * DEV only — Sales Booking Transfer is exactly-once.
 *   BASE=http://localhost:3520 node scripts/dev/sales-transfer-e2e.mjs
 * Clones a real DEV unposted sales order into a throw-away one and drives the REAL transfer route:
 * simultaneous requests WITHOUT an Idempotency-Key, a repeat after posting, a same-key replay, and a failed (pre-posting) request that must release the claim.
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
const transfer = async (id, body = {}, key) => {
  const headers = { cookie, "content-type": "application/json" }; if (key) headers["idempotency-key"] = key;
  const x = await fetch(`${BASE}/api/erp/sales/orders/${id}/transfer`, { method: "POST", headers, body: JSON.stringify(body) });
  let j = null; try { j = await x.json(); } catch {}
  return { status: x.status, j, msg: j?.error?.message || j?.message || "", code: j?.error?.code || "" };
};

const [src] = await sql`select * from sales_orders where deleted_at is null and ledger_posting_status = 'unposted' and customer_account_id is not null
  and coalesce(form_data->'form'->>'customerAccountNo','') <> '' and coalesce(form_data->'form'->>'salesAccountNo','') <> ''
  and coalesce(form_data->'form'->>'salesAccountLedgerId','') <> '' and coalesce(form_data->'workflow'->>'transferStatus','') <> 'transferred'
  order by created_at desc limit 1`;
if (!src) throw new Error("no unposted DEV sales order with accounts to clone");
const mkClone = async () => {
  const id = crypto.randomUUID();
  const clone = { ...src, id, sales_order_no: "E2ESTR-" + Math.random().toString(36).slice(2, 8).toUpperCase(), ledger_posting_status: "unposted", paid_amount: 0, is_edited_since_transfer: false, created_at: new Date(), updated_at: new Date() };
  for (const k of Object.keys(clone)) if (clone[k] === undefined || /serial/i.test(k) || k === "sales_contract_no") delete clone[k];
  const fd = JSON.parse(JSON.stringify(src.form_data || {}));
  // money path only: no managed-lot reservation (stock is covered by the Stock Journal harnesses)
  if (Array.isArray(fd.goodsEntries)) for (const g of fd.goodsEntries) { delete g.managedLotId; delete g.managedWarehouseId; delete g.managedRack; delete g.managedLabel; }
  clone.form_data = sql.json(fd);
  await sql`insert into sales_orders ${sql(clone)}`;
  return id;
};
const liveBookingPayments = async (id) => (await sql`select count(*)::int n from sales_order_payments where sales_order_id = ${id} and deleted_at is null`)[0].n;
const state = async (id) => (await sql`select ledger_posting_status s, form_data->'workflow'->>'transferStatus' ts, form_data->'workflow'->>'transferClaimAt' claim, form_data->'workflow'->>'transferPostedPaymentId' pp from sales_orders where id = ${id}`)[0];
const ids = [];
try {
  // 1) two simultaneous transfers, NO Idempotency-Key
  const a = await mkClone(); ids.push(a);
  const res = await Promise.all([transfer(a), transfer(a), transfer(a)]);
  const ok = res.filter((r) => r.status === 200).length;
  console.log("INFO simultaneous:", res.map((r) => `${r.status}${r.code ? "/" + r.code : ""}`).join(" "), "payments:", await liveBookingPayments(a), "state:", JSON.stringify(await state(a)));
  check("three simultaneous transfers (no key) post exactly ONE payment", (await liveBookingPayments(a)) === 1 && ok === 1, `payments=${await liveBookingPayments(a)} ok=${ok}`);
  check("the others are refused cleanly (409 / 400), never a 500", res.filter((r) => r.status !== 200).every((r) => r.status === 409 || r.status === 400), res.map((r) => r.status).join(","));
  const lines = await sql`select e.id, sum(l.debit)::float d, sum(l.credit)::float c from sales_order_payments p join roznamcha_entries e on e.id = p.roznamcha_entry_id join roznamcha_lines l on l.roznamcha_entry_id = e.id where p.sales_order_id = ${a} and p.deleted_at is null group by e.id`;
  check("journal is balanced (DR = CR) and one voucher", lines.length === 1 && near(lines[0].d, lines[0].c, 0.01), JSON.stringify(lines));
  const st = await state(a);
  check("order is marked transferred", st.s === "transferred" || st.s === "posted" || st.ts === "transferred", JSON.stringify(st));
  // 2) repeat after posting
  const again = await transfer(a);
  check("a repeat transfer of a posted order posts nothing", again.status !== 200 && (await liveBookingPayments(a)) === 1, `${again.status} ${again.msg}`);
  // 3) same key replay on a fresh order
  const b = await mkClone(); ids.push(b);
  const key = crypto.randomUUID();
  const r1 = await transfer(b, {}, key); const r2 = await transfer(b, {}, key);
  check("same Idempotency-Key replay posts once", r1.status === 200 && (await liveBookingPayments(b)) === 1, `${r1.status}/${r2.status} payments=${await liveBookingPayments(b)}`);
  // 4) pre-posting failure releases the claim (missing customer account -> validation error before the claim) then a valid transfer still works
  const c = await mkClone(); ids.push(c);
  await sql`update sales_orders set form_data = jsonb_set(form_data, '{form,customerAccountNo}', '""'::jsonb) where id = ${c}`;
  const bad = await transfer(c);
  check("an invalid request is refused and leaves no claim behind", bad.status >= 400 && !(await state(c)).claim, `${bad.status} ${bad.msg} claim=${(await state(c)).claim}`);
  await sql`update sales_orders set form_data = jsonb_set(form_data, '{form,customerAccountNo}', to_jsonb(${String(src.form_data?.form?.customerAccountNo)}::text)) where id = ${c}`;
  const good = await transfer(c);
  check("after the refused attempt a valid transfer posts once", good.status === 200 && (await liveBookingPayments(c)) === 1, `${good.status} ${good.msg}`);
  // 5) stale claim (crashed request) can be retaken after 3 minutes; a fresh claim cannot
  const d = await mkClone(); ids.push(d);
  await sql`update sales_orders set form_data = jsonb_set(form_data, '{workflow}', coalesce(form_data->'workflow','{}'::jsonb) || jsonb_build_object('transferClaimAt', now()::text)) where id = ${d}`;
  const fresh = await transfer(d);
  check("a fresh claim by another request blocks the transfer (409)", fresh.status === 409 && (await liveBookingPayments(d)) === 0, `${fresh.status} ${fresh.code}`);
  await sql`update sales_orders set form_data = jsonb_set(form_data, '{workflow,transferClaimAt}', to_jsonb((now() - interval '10 minutes')::text)) where id = ${d}`;
  const stale = await transfer(d);
  check("a stale claim (>3 min, nothing posted) can be retaken", stale.status === 200 && (await liveBookingPayments(d)) === 1, `${stale.status} ${stale.msg}`);
} catch (e) { fail++; console.log("FATAL", e?.stack || e); }
finally {
  for (const id of ids) await sql`update sales_orders set deleted_at = now() where id = ${id}`.catch(() => {});
  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end({ timeout: 5 });
  process.exit(fail ? 1 : 0);
}
