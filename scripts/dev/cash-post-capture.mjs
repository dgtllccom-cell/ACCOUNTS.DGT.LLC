/**
 * DEV ONLY (writes a TEST entry to the Testing database): drives the Cash Entry dialog through the real UI, posts one entry and records
 * the exact POST /api/erp/roznamcha payload + response. Run it against the OLD build and the NEW build with the same inputs and diff the
 * two outputs (scripts/dev/cash-post-diff.mjs) to prove the design change did not alter the posting payload or the posted DR/CR lines.
 *   BASE=http://localhost:3300 OUT=<file.json> MODE=DEBIT|CREDIT AMOUNT=100 TAG=<text> node scripts/dev/cash-post-capture.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3300"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const MODE = process.env.MODE || "DEBIT", AMOUNT = process.env.AMOUNT || "100", TAG = process.env.TAG || "design-equivalence-test";
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "country_admin", countryId: PK }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: "en", domain: "localhost", path: "/" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("erp_lang", "en"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} });
const p = await ctx.newPage();
let posted = null, response = null, lastCan = null;
p.on("console", async (m) => { if (m.text().startsWith("canSave check")) { try { lastCan = (await Promise.all(m.args().map((a) => a.jsonValue().catch(() => null)))).slice(1); } catch {} } });
p.on("request", (rq) => { if (rq.method() === "POST" && /\/api\/erp\/roznamcha$/.test(new URL(rq.url()).pathname)) posted = rq.postData(); });
p.on("response", async (rs) => { if (rs.request().method() === "POST" && /\/api\/erp\/roznamcha$/.test(new URL(rs.url()).pathname)) { try { response = await rs.json(); } catch {} } });
await p.goto(BASE + "/dashboard/roznamcha/cash-entry", { waitUntil: "load", timeout: 240000 });
await p.waitForTimeout(Number(process.env.WAIT0 || 12000));
await p.locator('button.bg-blue-600:has-text("New Entry")').first().click();
await p.waitForTimeout(2500);
const dlg = p.locator("div.fixed.inset-0 .relative").first();
await p.locator('option:text-is("Pakistan Main Branch")').first().waitFor({ state: "attached", timeout: 90000 });
await p.locator("select").filter({ has: p.locator('option:text-is("Pakistan Main Branch")') }).first().selectOption({ label: "Pakistan Main Branch" });
await p.waitForTimeout(2500);
await p.waitForFunction(() => { const b = [...document.querySelectorAll("button")].find((x) => /Search account code or name/.test(x.textContent || "")); return b && !b.disabled; }, null, { timeout: 90000 });
await p.locator("button:has-text('Search account code or name')").first().click();
await p.waitForTimeout(1500);
await p.locator("[cmdk-item]").first().click();
await p.waitForTimeout(1500);
await p.locator("select").filter({ has: p.locator('option[value="cash"]') }).first().selectOption("cash");
await p.waitForTimeout(500);
await p.locator("select").filter({ has: p.locator('option[value="USD"]') }).first().selectOption("USD");
await p.waitForTimeout(800);
await p.locator("div.space-y-1").filter({ has: p.locator("label", { hasText: /^(Amount|Quantity)/i }) }).locator("input").first().fill(AMOUNT);
await p.getByRole("button", { name: MODE === "DEBIT" ? /Debit \(Money Paid\)/ : /Credit \(Money Received\)/ }).first().click();
await p.locator("textarea").last().fill(TAG);
await p.waitForTimeout(1000);
await p.screenshot({ path: (process.env.OUT || "cap").replace(/\.json$/, "") + "-form.png" });
if (await p.getByRole("button", { name: /Post Entry/ }).first().isDisabled()) { console.log("POST DISABLED; canSave details:", JSON.stringify(lastCan)); }
await p.getByRole("button", { name: /Post Entry/ }).first().click({ timeout: 20000 });
await p.waitForTimeout(15000);
const result = { mode: MODE, amount: AMOUNT, tag: TAG, payload: posted ? JSON.parse(posted) : null, response };
fs.writeFileSync(process.env.OUT, JSON.stringify(result, null, 1));
console.log(posted ? "POSTED" : "NO POST CAPTURED", JSON.stringify(response)?.slice(0, 220));
await b.close();
