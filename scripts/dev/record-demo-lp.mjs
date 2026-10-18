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

await step("Local Purchase credit payment", async () => { await visit("/dashboard/purchase/local-purchase-transfer-payment", "Local Purchase — credit / remaining payment screen", 5000); await visit("/dashboard/purchase/local-purchase-journal-report", "Local Purchase journal report", 4000); });
await step("Remaining payment", async () => { await visit("/dashboard/journal/purchase-order-payment/remaining", "Purchase Order — Remaining Payment voucher", 5000); });
await caption("End of DEV demonstration. LIVE ERP verification requires an authorised sign-in."); await p.waitForTimeout(3000);
await ctx.close(); await b.close();
const vids = fs.readdirSync(OUT).filter((f) => f.endsWith(".webm"));
console.log(JSON.stringify({ steps, videos: vids.map((v) => path.join(OUT, v)) }, null, 1));
