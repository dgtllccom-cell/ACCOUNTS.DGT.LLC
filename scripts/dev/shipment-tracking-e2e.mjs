/**
 * DEV only — Shipment Tracking: the list is built from real customer orders, search narrows it, a shipment opens with its
 * detail, legs and events, and the API total agrees with the database.
 *   BASE=http://localhost:3520 OUT=<dir> node scripts/dev/shipment-tracking-e2e.mjs
 */
import fs from "node:fs";
import postgres from "postgres";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3520";
if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".ui-out/tracking"; fs.mkdirSync(OUT, { recursive: true });
const env = {};
for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
if (!env.DATABASE_URL.includes("csesvyxxjivnkkozgopt")) throw new Error("DEV DB only");
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });
const results = []; const check = (n, ok, d = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 180) : ""); };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const cookie = `erp_session=${token}`;

const list = await (await fetch(BASE + "/api/erp/tracking/list?limit=50", { headers: { cookie } })).json();
const rows = list.data?.rows ?? [];
const total = Number(list.data?.total ?? -1);
const [{ n: dbOrders }] = await sql`select count(*)::int n from public.clearing_customer_orders where deleted_at is null`;
check("tracking list returns rows from the API", rows.length > 0, `rows=${rows.length} total=${total}`);
check("tracking total equals the database's live customer orders", total === dbOrders, `api=${total} db=${dbOrders}`);
const ids = rows.map((x) => x.id);
const [{ n: found }] = await sql`select count(*)::int n from public.clearing_customer_orders where id = any(${ids}::uuid[]) and deleted_at is null`;
check("every listed shipment exists in the database", found === ids.length, `${found}/${ids.length}`);

const first = rows[0];
const detail = await fetch(BASE + `/api/erp/tracking/${first.id}`, { headers: { cookie } });
const dj = (await detail.json().catch(() => ({}))).data || {};
check("shipment detail API returns the selected shipment", detail.status === 200 && dj.shipment?.order_no === first.orderNo, `HTTP ${detail.status}`);
check("shipment detail includes its legs and KPIs", Array.isArray(dj.legs) && !!dj.kpis, `legs=${dj.legs?.length}`);
check("shipment detail includes its tracking events", Array.isArray(dj.events), `events=${dj.events?.length}`);

const countRows = (p) => p.evaluate(() => document.querySelectorAll("table tbody tr").length);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: "en", domain: "localhost", path: "/" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("erp_lang", "en"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
await p.goto(BASE + "/dashboard/tracking", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForFunction(() => !document.querySelector(".animate-spin") && document.body.innerText.length > 200, null, { timeout: 90000 }).catch(() => {});
await p.waitForTimeout(2000);
const text = await p.evaluate(() => document.body.innerText);
check("tracking page renders with no error text", text.length > 300 && !/Application error|Something went wrong/i.test(text), `len=${text.length}`);
check("tracking page shows the real order number from the database", text.includes(first.orderNo), first.orderNo);
check("tracking page shows no sample shipment names", !/LED TV|Global Cargo Logistics|ABC Exporters/.test(text));
const search = p.locator('input[type="search"]').first();
await search.fill(first.orderNo);
await p.waitForFunction((n) => document.querySelectorAll("table tbody tr").length === 1 && document.body.innerText.includes(n), first.orderNo, { timeout: 60000 }).catch(() => {});
const byOrder = await countRows(p);
check("search by order number narrows the table to that shipment", byOrder === 1, `rows=${byOrder}`);
await search.fill("zzz-no-such-shipment-zzz");
await p.waitForFunction(() => document.querySelectorAll("table tbody tr").length === 0 || /No (shipments|results|records)/i.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {});
const none = await countRows(p);
check("search for a non-existent shipment leaves no order rows", none === 0, `rows=${none}`);
await search.fill("");
await p.waitForFunction(() => document.querySelectorAll("table tbody tr").length > 1, null, { timeout: 60000 }).catch(() => {});
check("clearing the search restores the list", (await countRows(p)) > 1, "");
check("tracking page has no page errors", errs.length === 0, errs.join(" | "));
await p.screenshot({ path: `${OUT}/tracking.png` }).catch(() => {});
await b.close();
await sql.end();
console.log(`${results.filter(Boolean).length}/${results.length} passed`);
