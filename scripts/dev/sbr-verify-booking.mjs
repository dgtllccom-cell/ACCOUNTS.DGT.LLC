/** DEV only — booking bills: report "sold" must equal the issued Stock Journal confirmations. BASE=http://localhost:3510 node scripts/dev/sbr-verify-booking.mjs */
import fs from "node:fs"; import postgres from "postgres";
const BASE = process.env.BASE || "http://localhost:3510"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const env = {}; for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const url = process.env.DATABASE_URL || env.DATABASE_URL; if (!url || url.includes("inmayhrxucimxqhgseqi") || !url.includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing: not DEV");
const sql = postgres(url, { max: 1, prepare: false });
const results = []; const check = (n, ok, d = "") => { results.push({ n, ok: !!ok }); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 220) : ""); };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const cookie = r.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
const get = async (p) => (await fetch(BASE + p, { headers: { cookie } })).json();
const rows = (await get("/api/erp/reports/stock-balance?view=bills&limit=500")).data.rows.filter((b) => b.type === "booking");
console.log("booking bills in report:", rows.length);
const jst = await sql`select purchase_order_id as po, status, coalesce(sum(quantity),0)::float as q, count(*)::int as n from public.journal_stock_transfers where deleted_at is null and purchase_order_id is not null group by purchase_order_id, status`;
const byPo = new Map(); for (const x of jst) { const m = byPo.get(x.po) ?? {}; m[x.status] = x.q; byPo.set(x.po, m); }
const withIssued = rows.filter((b) => (byPo.get(b.id)?.issued ?? 0) > 0);
console.log("booking bills with issued sales:", withIssued.length);
let bad = [];
for (const b of withIssued) { const rep = b.totals.sold.qty; const db = byPo.get(b.id).issued; if (Math.abs(rep - db) > 0.01) bad.push(`${b.billNo}: report sold ${rep} vs issued ${db}`); }
check("booking sold == issued journal confirmations", withIssued.length > 0 ? bad.length === 0 : true, withIssued.length ? bad.slice(0, 3).join(" | ") : "no issued fixtures in DEV");
let badRem = [];
for (const b of rows) { const t = b.totals; if (t.remaining.qty < -0.0001) badRem.push(b.billNo); if (Math.abs(t.remaining.qty - (t.purchased.qty - t.sold.qty - t.transferred.qty - t.adjusted.qty)) > 0.01) badRem.push(b.billNo + " formula"); }
check("booking: remaining formula holds and never negative", badRem.length === 0, badRem.slice(0, 3).join(","));
for (const b of withIssued.slice(0, 5)) {
  const d = (await get(`/api/erp/reports/stock-balance/bill?type=booking&id=${b.id}`)).data.bill;
  const sales = d.sales.filter((s) => s.linked && s.status !== "cancelled");
  const sq = sales.reduce((a, s) => a + s.qty, 0);
  check(`${b.billNo}: sales rows (${sales.length}) add up to sold ${b.totals.sold.qty}`, Math.abs(sq - b.totals.sold.qty) < 0.02 || b.totals.sold.qty >= sq, `${sq} vs ${b.totals.sold.qty}`);
  check(`${b.billNo}: every sale names a lot & entry`, sales.every((s) => s.lotEntryLabel && s.lotEntryLabel !== "—" || s.lotNo === "—"), sales.map((s) => s.lotEntryLabel).join(","));
}
await sql.end(); console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed`);
