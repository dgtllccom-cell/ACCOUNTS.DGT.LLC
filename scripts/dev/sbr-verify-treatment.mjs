/**
 * DEV only — Treatment Register, permissions and exports of the Goods Movement & Stock report.
 *   BASE=http://localhost:3510 node scripts/dev/sbr-verify-treatment.mjs
 * Treatment is information only: it must never move/sell stock or post accounting. The harness proves that with row counts.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import postgres from "postgres";
import ExcelJS from "exceljs";
const BASE = process.env.BASE || "http://localhost:3510"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const env = {};
for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!url || url.includes("inmayhrxucimxqhgseqi") || !url.includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing: not the DEV database");
const sql = postgres(url, { max: 1, prepare: false });
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok }); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 220) : ""); };
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.0051;

const session = async (body) => { const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); return r.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session=")); };
const call = (cookie) => async (method, p, body) => { const x = await fetch(BASE + p, { method, headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }); const t = await x.text(); let j; try { j = JSON.parse(t); } catch { j = null; } return { status: x.status, j, raw: t }; };

const adminCookie = await session({ role: "super_admin" });
const admin = call(adminCookie);
const counts = async () => (await sql`select
  (select count(*) from public.goods_transfers)::int as gt, (select count(*) from public.lot_stock)::int as ls, (select coalesce(sum(qty),0) from public.lot_stock)::float as lsq,
  (select count(*) from public.stock_movements)::int as sm, (select count(*) from public.sales_orders)::int as so,
  (select count(*) from public.roznamcha_entries)::int as rz, (select count(*) from public.journal_stock_transfers)::int as jst`)[0];

// target: a local bill with free stock in its first entry
const list = (await admin("GET", "/api/erp/reports/stock-balance?view=bills&limit=500")).j.data.rows;
let bill, entry;
for (const b of list.filter((x) => x.type === "local")) { const d = (await admin("GET", `/api/erp/reports/stock-balance/bill?type=local&id=${b.id}`)).j.data.bill; const e = d.entries.find((x) => x.remaining.qty >= 10 && x.status !== "sold_out"); if (e) { bill = d; entry = e; break; } }
check("found a local bill entry with ≥10 free", !!entry, bill?.billNo);
const entryKey = entry.entryId.split("::").pop();
const R0 = entry.remaining.qty;
const before = await counts();
const key = "sbr-test-" + crypto.randomUUID();
const body = { idempotencyKey: key, billType: "local", billId: bill.id, lotNo: entry.lotNo, entryKey, treatmentType: "Fumigation (DEV test)", qtyReceived: 6, qtyTreated: 0, qtyLoss: 0 };

// ── create
const c1 = await admin("POST", "/api/erp/reports/stock-balance/treatment", body);
const tr = c1.j?.data?.treatment ?? c1.j?.data;
check("create treatment 200", c1.status === 200 && tr?.id, c1.status + " " + (c1.j?.error?.message || ""));
const c2 = await admin("POST", "/api/erp/reports/stock-balance/treatment", body);
const tr2 = c2.j?.data?.treatment ?? c2.j?.data;
check("same idempotency key → same record, no duplicate", c2.status === 200 && tr2?.id === tr?.id, tr2?.id);
const dupCount = (await sql`select count(*)::int n from public.stock_treatments where idempotency_key = ${key}`)[0].n;
check("exactly one DB row for that key", dupCount === 1, dupCount);

// ── limits
const over = await admin("POST", "/api/erp/reports/stock-balance/treatment", { ...body, idempotencyKey: "sbr-test-" + crypto.randomUUID(), qtyReceived: R0 + 1000 });
check("received above available stock is refused (409)", over.status === 409, over.status + " " + (over.j?.error?.code || ""));
const split = await admin("POST", "/api/erp/reports/stock-balance/treatment", { ...body, idempotencyKey: "sbr-test-" + crypto.randomUUID(), qtyReceived: 2, qtyTreated: 2, qtyLoss: 1 });
check("treated + loss above received is refused (4xx)", split.status >= 400 && split.status < 500, split.status + " " + (split.j?.error?.message || ""));
const zero = await admin("POST", "/api/erp/reports/stock-balance/treatment", { ...body, idempotencyKey: "sbr-test-" + crypto.randomUUID(), qtyReceived: 0 });
check("zero quantity is refused (400)", zero.status === 400, zero.status);

// ── report reflects it; stock unchanged
const d1 = (await admin("GET", `/api/erp/reports/stock-balance/bill?type=local&id=${bill.id}`)).j.data.bill;
const e1 = d1.entries.find((x) => x.entryId === entry.entryId);
const t1 = (d1.treatments || []).find((x) => x.id === tr.id);
check("treatment appears on the bill with received 6 / pending 6", !!t1 && near(t1.received, 6) && near(t1.pending, 6), JSON.stringify(t1 && { r: t1.received, p: t1.pending, s: t1.status }));
check("pending treatment does not change remaining stock", near(e1.remaining.qty, R0), `${R0} → ${e1.remaining.qty}`);

// ── update: 3 treated, 1 loss → loss reduces remaining by 1 (adjustment), nothing else
const u = await admin("PATCH", "/api/erp/reports/stock-balance/treatment", { id: tr.id, qtyTreated: 3, qtyLoss: 1, status: "in_progress" });
check("update treatment 200", u.status === 200, u.status + " " + (u.j?.error?.message || ""));
const d2 = (await admin("GET", `/api/erp/reports/stock-balance/bill?type=local&id=${bill.id}`)).j.data.bill;
const e2 = d2.entries.find((x) => x.entryId === entry.entryId); const t2 = d2.treatments.find((x) => x.id === tr.id);
check("treated 3 / loss 1 / pending 2 / final 5", near(t2.treated, 3) && near(t2.loss, 1) && near(t2.pending, 2) && near(t2.finalQty, 5), JSON.stringify({ t: t2.treated, l: t2.loss, p: t2.pending, f: t2.finalQty }));
check("treatment loss shows as adjustment and reduces remaining by exactly 1", near(e2.adjusted.qty, e1.adjusted.qty + 1) && near(e2.remaining.qty, R0 - 1), `adj ${e2.adjusted.qty} rem ${e2.remaining.qty}`);
const sameLoss = await admin("PATCH", "/api/erp/reports/stock-balance/treatment", { id: tr.id, qtyTreated: 6, qtyLoss: 2 });
check("update beyond received refused (4xx)", sameLoss.status >= 400 && sameLoss.status < 500, sameLoss.status);

// ── information only: no stock / sales / accounting rows created or changed
const mid = await counts();
check("treatment never touches stock, transfers, sales, movements, roznamcha or journal", JSON.stringify(mid) === JSON.stringify(before), JSON.stringify({ before, mid }));

// ── cancel
const noReason = await admin("DELETE", "/api/erp/reports/stock-balance/treatment", { id: tr.id, reason: "" });
check("cancel without reason refused (400)", noReason.status === 400, noReason.status);
const cx = await admin("DELETE", "/api/erp/reports/stock-balance/treatment", { id: tr.id, reason: "DEV test cleanup" });
check("cancel treatment 200", cx.status === 200, cx.status + " " + (cx.j?.error?.message || ""));
const d3 = (await admin("GET", `/api/erp/reports/stock-balance/bill?type=local&id=${bill.id}`)).j.data.bill;
const e3 = d3.entries.find((x) => x.entryId === entry.entryId);
check("cancelled treatment gives the loss back: remaining == original", near(e3.remaining.qty, R0), `${e3.remaining.qty} vs ${R0}`);
const after = await counts();
check("after cancel, all ledgers still identical to the start", JSON.stringify(after) === JSON.stringify(before));

// ── permissions: a country admin of ANOTHER country must not read, treat or export this bill
const countries = (await admin("GET", "/api/erp/reports/stock-balance/filters")).j.data.countries;
const other = countries.find((c) => c.id !== bill.countryId);
if (other) {
  const foreign = call(await session({ role: "country_admin", countryId: other.id }));
  const fl = (await foreign("GET", "/api/erp/reports/stock-balance?view=bills&limit=500")).j;
  check("other-country admin sees none of this country's bills", (fl?.data?.rows || []).every((b) => b.countryId !== bill.countryId || b.type === "booking"), (fl?.data?.rows || []).length + " rows");
  const fb = await foreign("GET", `/api/erp/reports/stock-balance/bill?type=local&id=${bill.id}`);
  check("other-country admin cannot open the bill (403/404)", [403, 404].includes(fb.status), fb.status);
  const ft = await foreign("POST", "/api/erp/reports/stock-balance/treatment", { ...body, idempotencyKey: "sbr-test-" + crypto.randomUUID() });
  check("other-country admin cannot add treatment (403/404)", [403, 404].includes(ft.status), ft.status);
  const fx = await foreign("GET", `/api/erp/reports/stock-balance/export?kind=bill&type=local&id=${bill.id}`);
  check("other-country admin cannot export the bill (403/404)", [403, 404].includes(fx.status), fx.status);
  const ff = await foreign("GET", `/api/erp/reports/stock-balance?view=bills&countryId=${bill.countryId}`);
  check("explicit foreign country filter does not widen scope (403 or empty)", ff.status === 403 || (ff.j?.data?.rows || []).filter((b) => b.countryId === bill.countryId && b.type === "local").length === 0, ff.status);
}
const anon = await fetch(BASE + "/api/erp/reports/stock-balance?view=bills", { redirect: "manual" });
check("no session → no data", anon.status === 401 || anon.status === 307 || anon.status === 403, anon.status);

// ── exports
for (const kind of ["journal", "bills", "sales", "stock", "payments", "treatments"]) {
  for (const lang of kind === "journal" ? ["en", "ur", "ar"] : ["en"]) {
    const x = await fetch(`${BASE}/api/erp/reports/stock-balance/export?kind=${kind}&lang=${lang}`, { headers: { cookie: adminCookie + "; erp_lang=" + lang } });
    const buf = Buffer.from(await x.arrayBuffer());
    let rows = -1, rtl = null;
    if (x.status === 200) { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); const ws = wb.worksheets[0]; rows = ws?.rowCount ?? 0; rtl = ws?.views?.[0]?.rightToLeft ?? false; }
    check(`excel export ${kind}${lang !== "en" ? " (" + lang + ")" : ""}`, x.status === 200 && /spreadsheetml/.test(x.headers.get("content-type") || "") && rows > 1, `${x.status} rows=${rows}`);
  }
}
const one = await fetch(`${BASE}/api/erp/reports/stock-balance/export?kind=bill&type=local&id=${bill.id}`, { headers: { cookie: adminCookie } });
check("excel export single bill", one.status === 200, one.status);

await sql.end();
console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed`);
process.exit(results.every((x) => x.ok) ? 0 : 1);
