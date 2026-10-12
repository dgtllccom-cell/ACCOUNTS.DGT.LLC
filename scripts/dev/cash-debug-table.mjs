// DEV debug: click "All Dates" (table mode) and print the roznamcha list requests + visible row count. ROLE/COUNTRY_ID envs as cash-click-shot.
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3300";
const body = { role: process.env.ROLE || "super_admin", countryId: process.env.COUNTRY_ID || undefined, countryBranchId: process.env.COUNTRY_BRANCH_ID || undefined, cityBranchId: process.env.CITY_BRANCH_ID || undefined, operationalDomain: process.env.DOMAIN || undefined };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: "en", domain: "localhost", path: "/" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("erp_lang", "en"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} });
const p = await ctx.newPage();
p.on("response", async (res) => { const u = res.url(); if (/api\/erp\/roznamcha\?/.test(u)) { let n = "?"; try { const j = await res.json(); n = (j.data?.entries ?? []).length; } catch {} console.log("API", n, decodeURIComponent(u.replace(BASE, "")).slice(0, 190)); } });
await p.goto(BASE + "/dashboard/roznamcha/cash-entry", { waitUntil: "load", timeout: 240000 });
await p.waitForTimeout(12000);
console.log("--- click All Dates (table)");
await p.locator('div.inline-flex.rounded-lg button:has-text("All Dates")').first().click();
await p.waitForTimeout(25000);
const info = await p.evaluate(() => ({ rows: document.querySelectorAll("table tbody tr").length, text: (document.querySelector("table.min-w-\\[1050px\\] tbody")?.innerText || "").slice(0, 120), pager: document.querySelector(".dgt-cj-pager")?.innerText }));
console.log(JSON.stringify(info));
await b.close();
