/**
 * DEV ONLY — records a narrated-by-caption demonstration video (webm) of the ERP pages, using a DEV session and DEV test data.
 *   BASE=http://localhost:3510 OUT=<dir> node scripts/dev/record-demo.mjs
 * No passwords or OTPs are involved (dev-session), and the DEV database holds test data only.
 */
import fs from "node:fs"; import path from "node:path"; import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3510"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, recordVideo: { dir: OUT, size: { width: 1366, height: 768 } } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: "en", domain: "localhost", path: "/" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("erp_lang", "en"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} });
const p = await ctx.newPage();
const caption = async (text) => p.evaluate((t) => { let d = document.getElementById("__cap"); if (!d) { d = document.createElement("div"); d.id = "__cap"; d.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483647;background:rgba(15,23,42,.92);color:#fff;font:600 15px system-ui,sans-serif;padding:9px 18px;border-radius:999px;box-shadow:0 4px 18px rgba(0,0,0,.35);max-width:90vw;text-align:center"; document.body.appendChild(d); } d.textContent = t; }, text).catch(() => {});
const settle = async () => { await p.waitForFunction(() => !document.querySelector(".animate-spin") && !/Loading (Report|report)/.test(document.body.innerText.slice(0, 3000)), null, { timeout: 90000 }).catch(() => {}); await p.waitForTimeout(1500); };
const visit = async (url, text, hold = 3500) => { await p.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 180000 }); await settle(); await caption(text); await p.waitForTimeout(hold); };
const steps = [];
const step = async (name, fn) => { try { await fn(); steps.push(name + ": shown"); } catch (e) { steps.push(name + ": FAILED " + String(e).slice(0, 80)); await caption("(step failed: " + name + ")"); await p.waitForTimeout(1500); } };

await step("Dashboard", () => visit("/dashboard", "DGT ERP — DEV demonstration (test data only, no real records)", 3500));
await step("Truck Registration", () => visit("/dashboard/clearing-agent/truck-registration", "Truck Registration (central truck master)"));
await step("Mobile Review Pass", async () => { await visit("/dashboard/super-admin/mobile-devices", "Mobile device approval & Review Pass (Super Admin) — DEV", 4500); });
await step("Purchase Booking journal", () => visit("/dashboard/purchase/purchase-booking-journal-report", "Purchase Booking journal — transfer needs confirmation and is posted once", 4500));
await step("Sales Booking journal", () => visit("/dashboard/sales/sales-booking-journal-report", "Sales Booking journal"));
await step("Local Purchase credit payment", () => visit("/dashboard/purchase/local-purchase-transfer-payment", "Local Purchase — credit / remaining payment screen", 4500));
await step("Ledger reports", async () => { await visit("/dashboard/ledger/outstanding", "Outstanding balances — ledger report", 3500); await visit("/dashboard/ledger/general-report", "General ledger report", 3500); });
await step("Grid / List view", async () => {
  await visit("/dashboard/purchase/stock/report", "Goods Movement & Stock Report — List view", 3000);
  await p.locator("[data-testid='view-grid']").first().click(); await caption("Grid view — the same records as cards"); await p.waitForTimeout(4500);
  await p.locator("[data-testid='view-list']").first().click(); await caption("Back to List view — choice is remembered per report"); await p.waitForTimeout(3000);
});
await step("Shipment Tracking", async () => { await visit("/dashboard/shipping-line/tracking", "Shipment Tracking — redesigned (real records only)", 5000); });
await caption("End of DEV demonstration. LIVE ERP verification requires an authorised sign-in."); await p.waitForTimeout(3000);
await ctx.close(); await b.close();
const vids = fs.readdirSync(OUT).filter((f) => f.endsWith(".webm"));
console.log(JSON.stringify({ steps, videos: vids.map((v) => path.join(OUT, v)) }, null, 1));
