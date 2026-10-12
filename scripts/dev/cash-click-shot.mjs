// DEV only: open a page, click a button by visible text (optional), screenshot. BASE OUT NAME PATH [CLICK="New Entry"] [LANG=en] [W=1440 H=900] [FULL=1]
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3300"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const lang = process.env.LANG_CODE || "en";
const body = { role: process.env.ROLE || "super_admin", countryId: process.env.COUNTRY_ID || undefined, countryBranchId: process.env.COUNTRY_BRANCH_ID || undefined, cityBranchId: process.env.CITY_BRANCH_ID || undefined, operationalDomain: process.env.DOMAIN || undefined };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const W = Number(process.env.W || 1440), H = Number(process.env.H || 900);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: W < 600 ? 2 : 1, isMobile: W < 600 });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
await ctx.addInitScript((l) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, lang);
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
await p.goto(BASE + (process.env.PATH_ERP || "/dashboard/roznamcha/cash-entry"), { waitUntil: "load", timeout: 240000 });
await p.waitForTimeout(Number(process.env.SETTLE || 8000));
for (const c of (process.env.CLICK ? process.env.CLICK.split("|") : [])) {
  await (process.env.SEL ? p.locator(process.env.SEL) : p.getByRole("button", { name: new RegExp(c, "i") }).first()).first().click({ timeout: 15000 }).catch((e) => console.log("click failed:", c, String(e).slice(0, 80)));
  await p.waitForTimeout(2500);
}
if (process.env.WAIT_ROWS === "1") await p.waitForFunction(() => /of [1-9]/.test(document.querySelector(".dgt-cj-pager")?.innerText || ""), null, { timeout: 90000 }).catch(() => {});
await p.waitForFunction(() => !document.querySelector("td[colspan=\"13\"].italic"), null, { timeout: 90000 }).catch(() => {});
await p.waitForTimeout(1500);
await p.screenshot({ path: process.env.OUTFILE, fullPage: process.env.FULL === "1" });
console.log("saved", process.env.OUTFILE, errs.length ? "ERR " + errs[0] : "");
await b.close();
