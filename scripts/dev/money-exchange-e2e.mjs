/**
 * DEV only — Money Exchange page renders for a super admin, shows no invented serial and no page errors.
 *   BASE=http://localhost:3520 OUT=<dir> node scripts/dev/money-exchange-e2e.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3520";
if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".ui-out/money-exchange"; fs.mkdirSync(OUT, { recursive: true });
const results = []; const check = (n, ok, d = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 200) : ""); };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: "en", domain: "localhost", path: "/" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("erp_lang", "en"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
await p.goto(BASE + "/dashboard/roznamcha/money-exchange", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForFunction(() => !document.querySelector(".animate-spin") && document.body.innerText.length > 200, null, { timeout: 90000 }).catch(() => {});
await p.waitForTimeout(2000);
const text = await p.evaluate(() => document.body.innerText);
check("money exchange page renders", text.length > 300, `len=${text.length}`);
check("no invented serial pattern (-EX-) shown", !/-EX-\d{6}-\d{4}/.test(text), "");
check("no page errors", errs.length === 0, errs.join(" | "));
check("no server-error text", !/Internal Server Error|Application error/i.test(text));
await p.screenshot({ path: `${OUT}/money-exchange.png` }).catch(() => {});
await b.close();
console.log(`${results.filter(Boolean).length}/${results.length} passed`);
