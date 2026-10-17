/** DEV only — the Live Report must follow the selected Account Type. BASE=http://localhost:3510 OUT=<dir> [LANG_CODE=en] node scripts/dev/account-live-report-e2e.mjs */
import fs from "node:fs"; import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3510"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true }); const LANG = process.env.LANG_CODE || "en";
const results = []; const check = (n, ok, d = "") => { results.push({ n, ok: !!ok }); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 160) : ""); };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: Number(process.env.W || 1440), height: 1000 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: LANG, domain: "localhost", path: "/" }]);
await ctx.addInitScript(([l]) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, [LANG]);
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
await p.goto(BASE + "/dashboard/accounts/setup", { waitUntil: "load", timeout: 240000 });
await p.getByRole("button", { name: /New Account/ }).first().click(); await p.getByText(/Manual Entry/).first().click(); await p.waitForSelector("#subType", { timeout: 60000 });
await p.waitForTimeout(3000);
// the live-report side panel: look at its section headings (Customer / Company / Bank / Warehouse)
const cards = async () => p.evaluate(() => { const t = document.body.innerText; return { customer: /CUSTOMER INFORMATION|Customer Information/i.test(t), company: /COMPANY DETAILS|Company Details/i.test(t), bank: /BANK DETAILS|Bank Details|BANKING/i.test(t) && /IBAN/i.test(t), warehouse: /WAREHOUSE DETAILS|Warehouse Details/i.test(t) && /Default|warehouse/i.test(t) }; });
const pick = async (sub) => { await p.selectOption("#subType", { label: sub }).catch(async () => { await p.selectOption("#subType", sub); }); await p.waitForTimeout(1200); };
// 1) Business Account (default)
let c = await cards(); await p.screenshot({ path: `${OUT}/${LANG}-business-account.png`, fullPage: true });
console.log("business:", JSON.stringify(c));
check("Customer › Business Account shows Customer + Company cards, no Bank / Warehouse", c.customer && c.company && !c.bank && !c.warehouse);
// 2) Personal Account
await pick("Personal Account"); c = await cards(); await p.screenshot({ path: `${OUT}/${LANG}-personal-account.png`, fullPage: true });
console.log("personal:", JSON.stringify(c));
check("Customer › Personal Account shows Customer only (no Company, Bank or Warehouse)", c.customer && !c.company && !c.bank && !c.warehouse);
// 3) back to Business → company returns
await pick("Business Account"); c = await cards();
check("switching back to Business Account brings the Company card back", c.customer && c.company && !c.bank);
check("no page errors", errs.length === 0, errs.slice(0, 2).join(" | "));
await b.close(); console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed`);
