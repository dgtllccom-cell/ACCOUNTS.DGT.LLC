/** DEV only — role / scope matrix of the Goods Movement & Stock report. BASE=http://localhost:3510 node scripts/dev/sbr-verify-roles.mjs */
import fs from "node:fs"; import postgres from "postgres";
const BASE = process.env.BASE || "http://localhost:3510"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const env = {}; for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const url = process.env.DATABASE_URL || env.DATABASE_URL; if (!url || url.includes("inmayhrxucimxqhgseqi") || !url.includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing: not DEV");
const sql = postgres(url, { max: 1, prepare: false });
const results = []; const check = (n, ok, d = "") => { results.push({ n, ok: !!ok }); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 200) : ""); };
const sess = async (b) => { const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); return r.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session=")); };
const api = (cookie) => async (p) => { const x = await fetch(BASE + p, { headers: { cookie }, redirect: "manual" }); let j = null; try { j = await x.json(); } catch {} return { status: x.status, j }; };
const prof = (await sql`select id from public.profiles limit 1`)[0].id;
const admin = api(await sess({ role: "super_admin" }));
const all = (await admin("/api/erp/reports/stock-balance?view=bills&limit=500")).j.data.rows;
const pk = all.find((b) => b.type === "local" && b.cityBranchId && b.countryName === "Pakistan");
const pkRows = all.filter((b) => b.countryId === pk.countryId);
const cityRows = all.filter((b) => b.cityBranchId === pk.cityBranchId);
const showBranch = (rows) => rows.filter((b) => b.type === "local" || true);
console.log(`PK country ${pkRows.length} bills · city ${pk.cityName} ${cityRows.length} bills · total ${all.length}`);

const cases = [
  ["country_admin (own country)", { role: "country_admin", countryId: pk.countryId }, (rows) => rows.every((b) => b.countryId === pk.countryId || b.type === "booking"), true],
  ["main_branch_admin", { role: "main_branch_admin", countryId: pk.countryId, countryBranchId: pk.countryBranchId }, (rows) => rows.every((b) => b.countryId === pk.countryId || b.type === "booking"), null],
  ["city_branch_admin", { role: "city_branch_admin", countryId: pk.countryId, countryBranchId: pk.countryBranchId, cityBranchId: pk.cityBranchId }, (rows) => rows.every((b) => b.type === "booking" || b.cityBranchId === pk.cityBranchId), null],
  ["accountant", { role: "accountant", countryId: pk.countryId }, (rows) => rows.every((b) => b.countryId === pk.countryId || b.type === "booking"), null],
  ["staff_user", { role: "staff_user", countryId: pk.countryId, countryBranchId: pk.countryBranchId, cityBranchId: pk.cityBranchId }, (rows) => rows.every((b) => b.type === "booking" || b.cityBranchId === pk.cityBranchId), null],
  ["auditor_viewer", { role: "auditor_viewer", countryId: pk.countryId }, (rows) => rows.every((b) => b.countryId === pk.countryId || b.type === "booking"), null],
];
for (const [name, body, scopeOk] of cases) {
  const c = await sess(body); const a = api(c);
  const list = await a("/api/erp/reports/stock-balance?view=bills&limit=500");
  if (list.status !== 200) { console.log("INFO", name, "→ list status", list.status, list.j?.error?.code || ""); check(`${name}: denied cleanly (403, not a crash)`, list.status === 403 || list.status === 401, list.status); continue; }
  const rows = list.j.data.rows, perms = list.j.data.perms;
  console.log("INFO", name, "rows", rows.length, "perms", JSON.stringify(perms));
  check(`${name}: only own-scope local bills`, scopeOk(rows) && rows.length <= all.length, rows.length);
  check(`${name}: row count never exceeds what super admin sees`, rows.length <= all.length);
  const exp = await fetch(`${BASE}/api/erp/reports/stock-balance/export?kind=journal`, { headers: { cookie: c }, redirect: "manual" });
  check(`${name}: Excel export follows the export permission`, perms.export ? exp.status === 200 : exp.status === 403, `perm=${perms.export} http=${exp.status}`);
  const cs = await a("/api/erp/reports/stock-balance?view=payments&limit=5");
  const hasMoney = (cs.j?.data?.rows ?? []).some((r) => r.amount != null && r.amount !== 0);
  check(`${name}: money hidden when the role may not see financials`, perms.money || !hasMoney, `money=${perms.money} sawAmounts=${hasMoney}`);
  // a bill of another country: must be invisible
  const other = all.find((b) => b.countryId !== pk.countryId && b.type === "local");
  if (other) { const ob = await a(`/api/erp/reports/stock-balance/bill?type=local&id=${other.id}`); check(`${name}: other-country local bill → 403/404`, [403, 404].includes(ob.status), ob.status); }
}
await sql.end(); console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed`);
