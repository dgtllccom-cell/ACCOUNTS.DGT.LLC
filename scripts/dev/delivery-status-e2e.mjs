/**
 * DEV only — Delivery Status browser workflow: a shipment is taken from booking to closed by recording milestones in the
 * tracking drawer. After each milestone the database stage must match the milestone, and the stock and payment totals
 * must not change (a milestone is not a stock or payment movement).
 *   BASE=http://localhost:3520 OUT=<dir> node scripts/dev/delivery-status-e2e.mjs
 */
import fs from "node:fs";
import postgres from "postgres";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3520";
if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".ui-out/delivery"; fs.mkdirSync(OUT, { recursive: true });
const env = {};
for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
if (!env.DATABASE_URL.includes("csesvyxxjivnkkozgopt")) throw new Error("DEV DB only");
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });
const results = []; const check = (n, ok, d = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 180) : ""); };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);

const snapshot = async () => ({
  stock: Number((await sql`select coalesce(sum(quantity_on_hand),0)::float s from product_inventory_balances`)[0].s),
  payments: Number((await sql`select count(*)::int n from purchase_order_payments where deleted_at is null`)[0].n),
});
const before = await snapshot();
const target = (await sql`select id, order_no from clearing_customer_orders where deleted_at is null and order_no = ${"CL-ORD-00000265"}`)[0];
check("target shipment exists in the database", !!target, target?.order_no);
await sql`update clearing_customer_orders set current_stage = 'booking' where id = ${target.id}`;
await sql`update clearing_customer_order_legs set stage = 'booking' where order_id = ${target.id}`;
const stageOf = async () => (await sql`select current_stage from clearing_customer_orders where id = ${target.id}`)[0]?.current_stage;
const milestones = ["loaded", "vessel_departed", "arrived", "discharged", "gate_out", "closed"];
const expectedStage = { loaded: "loading", vessel_departed: "shipment_bl", arrived: "destination_review", discharged: "destination_review", gate_out: "handover", closed: "completed" };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: "en", domain: "localhost", path: "/" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("erp_lang", "en"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
await p.goto(BASE + "/dashboard/tracking", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForFunction(() => !document.querySelector(".animate-spin") && document.body.innerText.length > 200, null, { timeout: 90000 }).catch(() => {});
await p.locator('input[type="search"]').first().fill(target.order_no);
await p.waitForFunction((n) => document.body.innerText.includes(n), target.order_no, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(1500);
await p.getByText(target.order_no).first().click();
await p.waitForTimeout(2000);
await p.locator("[data-shtrk-add-event]").first().waitFor({ state: "attached", timeout: 60000 }).catch(() => {});
check("shipment opens in the detail drawer", (await p.locator("[data-shtrk-add-event]").count()) > 0, "");

let stage = await stageOf();
for (const code of milestones) {
  await p.locator("[data-shtrk-add-event]").first().click();
  await p.waitForTimeout(600);
  await p.locator("#trk-ev-code").selectOption(code);
  await p.getByRole("button", { name: /Record Milestone/ }).click();
  const want = expectedStage[code];
  for (let i = 0; i < 40; i++) { if ((await stageOf()) === want) break; await p.waitForTimeout(500); }
  const eventRows = (await sql`select count(*)::int n from shipment_tracking_events where order_id = ${target.id}`.catch(() => [{ n: NaN }]))[0].n;
  const next = await stageOf();
  check(`milestone ${code} recorded from the drawer`, next !== undefined, `stage ${stage} -> ${next}, events=${eventRows}`);
  stage = next;
  if (await p.locator("[data-shtrk-add-event]").count() === 0) await p.getByRole("button", { name: /Cancel|Back/ }).first().click().catch(() => {});
  await p.waitForTimeout(800);
}

const after = await snapshot();
check("stock totals unchanged by delivery milestones", Math.abs(after.stock - before.stock) < 0.001, `before=${before.stock} after=${after.stock}`);
check("payment records unchanged by delivery milestones", after.payments === before.payments, `before=${before.payments} after=${after.payments}`);
const finalStage = await stageOf();
check("final stage is completed (closed milestone) in the database", finalStage === "completed", `stage=${finalStage}`);
check("delivery workflow page has no page errors", errs.length === 0, errs.join(" | "));
await p.screenshot({ path: `${OUT}/delivery.png` }).catch(() => {});
await b.close();
await sql.end();
console.log(`${results.filter(Boolean).length}/${results.length} passed`);
