/**
 * DEV only — cross-check the Goods Movement & Stock report against the physical ledger (lot_stock) and its own invariants.
 *   BASE=http://localhost:3510 node scripts/dev/sbr-verify-balance.mjs
 */
import fs from "node:fs";
import postgres from "postgres";
const BASE = process.env.BASE || "http://localhost:3510"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const env = {};
for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!url || url.includes("inmayhrxucimxqhgseqi") || !url.includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing: not the DEV database");
const sql = postgres(url, { max: 1, prepare: false });
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok }); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 220) : ""); };
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.0051;

const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const cookie = r.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
const get = async (p) => { const x = await fetch(BASE + p, { headers: { cookie } }); return { status: x.status, j: await x.json().catch(() => ({})) }; };

const list = await get("/api/erp/reports/stock-balance?view=bills&page=1&limit=500");
const rows = list.j.data.rows;
check("bills list loads", list.status === 200 && rows.length > 0, rows.length + " bills");

// 1) card totals == sum of the bill rows (single source, per unit)
const cards = list.j.data.cards;
const sumUnit = (pick) => { const m = {}; for (const b of rows) for (const [u, w] of Object.entries(b.totals.byUnit?.[pick] ?? {})) m[u] = (m[u] || 0) + w.qty; return m; };
const pu = sumUnit("purchased");
check("cards.purchase.qty == sum of bills' purchased", near(cards.purchase.qty, Object.values(pu).reduce((a, b) => a + b, 0)), cards.purchase.qty);
check("no unit appears twice by letter case", (() => { const k = Object.keys(cards.purchase.byUnit).map((x) => x.toLowerCase()); return new Set(k).size === k.length; })(), Object.keys(cards.purchase.byUnit).join(","));
check("remaining = purchased − sold − transferred − adjusted (every bill)", rows.every((b) => near(b.totals.remaining.qty, b.totals.purchased.qty - b.totals.sold.qty - b.totals.transferred.qty - b.totals.adjusted.qty)), "");
check("no negative remaining on any bill", rows.every((b) => b.totals.remaining.qty >= -0.0001), rows.filter((b) => b.totals.remaining.qty < 0).map((b) => b.billNo).join(","));

// 2) lot-level: local bills — remaining must equal physical lot_stock (available + reserved + in_transit) per lot
let billsChecked = 0, billMismatch = [], lotsChecked = 0, lotMismatch = [], negEntries = [], entriesChecked = 0;
for (const b of rows.filter((x) => x.type === "local").slice(0, 60)) {
  const d = (await get(`/api/erp/reports/stock-balance/bill?type=local&id=${b.id}`)).j.data.bill;
  const lots = await sql`select l.lot_no, l.id from public.purchase_lots l where l.local_purchase_id = ${b.id}::uuid`;
  const stock = lots.length ? await sql`select l.lot_no, coalesce(sum(ls.qty) filter (where ls.state in ('available','reserved','in_transit')),0) as live from public.purchase_lots l left join public.lot_stock ls on ls.lot_id = l.id where l.local_purchase_id = ${b.id}::uuid group by l.lot_no` : [];
  const reportByLot = {};
  for (const e of d.entries) { reportByLot[e.lotNo] = (reportByLot[e.lotNo] || 0) + e.remaining.qty; entriesChecked++; if (e.remaining.qty < -0.0001) negEntries.push(e.lotEntryLabel); }
  { const live = await sql`select coalesce(sum(ls.qty) filter (where ls.state in ('available','reserved','in_transit')),0) as live from public.purchase_lots l join public.lot_stock ls on ls.lot_id = l.id where l.local_purchase_id = ${b.id}::uuid`; billsChecked++; const rep = d.entries.reduce((a, e) => a + e.remaining.qty, 0); if (lots.length && !near(rep, live[0].live)) billMismatch.push(`${b.billNo}: report ${rep} vs lot_stock ${live[0].live}`); }
  for (const s of stock.filter((x) => x.lot_no)) { lotsChecked++; if (!near(reportByLot[s.lot_no] ?? NaN, s.live)) lotMismatch.push(`${b.billNo}/${s.lot_no}: report ${reportByLot[s.lot_no]} vs lot_stock ${s.live}`); }
}
check(`lot remaining == physical lot_stock (${lotsChecked} lots, ${entriesChecked} entries)`, lotMismatch.length === 0 && lotsChecked > 0, lotMismatch.slice(0, 3).join(" | "));
check(`bill remaining == physical lot_stock (${billsChecked} bills)`, billMismatch.length === 0 && billsChecked > 0, billMismatch.slice(0, 3).join(" | "));
check("no negative entry remaining", negEntries.length === 0, negEntries.slice(0, 3).join(","));

// 3) sales: every linked sale belongs to a lot of its bill; sum of completed sale qty == entry sold
let saleBad = [];
for (const b of rows.filter((x) => x.salesCount > 0).slice(0, 25)) {
  const d = (await get(`/api/erp/reports/stock-balance/bill?type=${b.type}&id=${b.id}`)).j.data.bill;
  const counted = d.sales.filter((s) => s.linked && !/cancel/i.test(s.status)).reduce((a, s) => a + s.qty, 0);
  const soldE = d.entries.reduce((a, e) => a + e.sold.qty, 0);
  if (counted > 0 && soldE > 0 && counted + 0.01 < soldE) saleBad.push(`${b.billNo}: sales ${counted} < entry sold ${soldE}`);
  if (d.sales.some((s) => s.linked && s.billId && s.billId !== b.id)) saleBad.push(b.billNo + " foreign sale");
}
check("linked sales reconcile to entry sold qty and never cross bills", saleBad.length === 0, saleBad.slice(0, 3).join(" | "));

// 4) other views + filters + pagination
for (const v of ["stock", "sales", "payments", "treatments"]) { const x = await get(`/api/erp/reports/stock-balance?view=${v}&limit=5`); check(`view ${v} 200`, x.status === 200, x.j?.error?.message || x.j?.data?.pagination?.totalRecords + " rows"); }
const p1 = await get("/api/erp/reports/stock-balance?view=bills&page=1&limit=20"), p2 = await get("/api/erp/reports/stock-balance?view=bills&page=2&limit=20");
check("pagination returns different pages", p1.j.data.rows[0]?.id !== p2.j.data.rows[0]?.id && p1.j.data.rows.length === 20);
const one = rows.find((b) => b.type === "local");
const fb = await get(`/api/erp/reports/stock-balance?view=bills&billNo=${encodeURIComponent(one.billNo)}`);
check("Purchase Bill No filter narrows to that bill", fb.j.data.rows.length >= 1 && fb.j.data.rows.every((b) => b.billNo.includes(one.billNo)), fb.j.data.rows.length);
const fc = await get(`/api/erp/reports/stock-balance?view=bills&countryId=${one.countryId}`);
check("Country filter: own-country bills + bookings destined there only", fc.j.data.rows.length >= rows.filter((b) => b.countryId === one.countryId).length && fc.j.data.rows.every((b) => b.countryId === one.countryId || b.type === "booking"), fc.j.data.rows.length);
const fs2 = await get("/api/erp/reports/stock-balance?view=bills&stockStatus=sold_out");
check("Stock status filter works", fs2.status === 200, fs2.j.data?.rows?.length + " rows");

// 5) lot report
const lotBill = rows.find((b) => b.type === "local" && b.salesCount > 0) || one;
const lb = (await get(`/api/erp/reports/stock-balance/bill?type=${lotBill.type}&id=${lotBill.id}`)).j.data.bill;
const lr = await get(`/api/erp/reports/stock-balance/lot?type=${lotBill.type}&billId=${lotBill.id}&lotNo=${encodeURIComponent(lb.entries[0].lotNo)}`);
check("lot report loads with entries", lr.status === 200 && lr.j.data.entries.length > 0, lr.j?.error?.message || "");

await sql.end();
console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed`);
process.exit(results.every((x) => x.ok) ? 0 : 1);
