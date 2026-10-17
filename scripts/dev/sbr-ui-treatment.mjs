/** DEV only — Treatment Register through the real UI: add (limits), update, cancel. BASE=http://localhost:3510 OUT=<dir> node scripts/dev/sbr-ui-treatment.mjs */
import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3510"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const LANG = process.env.LANG_CODE || "en";
const results = [];
const check = (n, ok, d = "") => { results.push({ n, ok: !!ok }); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 180) : ""); };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: LANG, domain: "localhost", path: "/" }]);
await ctx.addInitScript(([l]) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, [LANG]);
const p = await ctx.newPage(); const errors = [];
p.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
p.on("console", (m) => { if (m.type() === "error" && !/Failed to fetch|favicon|Failed to load resource|ResizeObserver|DevTools|presence|dgt-connect/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
const settle = async () => { await p.waitForFunction(() => !document.querySelector(".animate-spin"), null, { timeout: 120000 }).catch(() => {}); await p.waitForTimeout(1200); };
// find a local bill with free stock through the API (read-only)
const cookie = "erp_session=" + token;
const rows = (await (await fetch(BASE + "/api/erp/reports/stock-balance?view=bills&limit=500", { headers: { cookie } })).json()).data.rows;
let target; for (const x of rows.filter((y) => y.type === "local")) { const d = (await (await fetch(`${BASE}/api/erp/reports/stock-balance/bill?type=local&id=${x.id}`, { headers: { cookie } })).json()).data.bill; if (d.entries.some((e) => e.remaining.qty >= 10)) { target = d; break; } }
await p.goto(`${BASE}/dashboard/purchase/stock/report?bill=local:${target.id}`, { waitUntil: "load", timeout: 240000 });
await p.waitForSelector("[data-testid='sbr-bill-view']", { timeout: 180000 }); await settle();
await p.locator("[data-testid='sbr-add-treatment']").first().click(); await settle();
check("treatment form opens", (await p.locator("[data-testid='sbr-treatment-form']").count()) > 0);
await p.screenshot({ path: `${OUT}/${LANG}-treatment-form.png` });
await p.locator("[data-testid='sbr-tr-type']").selectOption({ index: 1 });
await p.locator("[data-testid='sbr-tr-received']").fill("3"); await p.locator("[data-testid='sbr-tr-treated']").fill("2"); await p.locator("[data-testid='sbr-tr-loss']").fill("5");
await p.locator("[data-testid='sbr-tr-submit']").click(); await p.waitForTimeout(2500);
check("treated+loss above received shows an error and keeps the form open", (await p.locator("[data-testid='sbr-treatment-form']").count()) > 0 && (await p.locator("[role='alert']").count()) > 0);
await p.locator("[data-testid='sbr-tr-loss']").fill("1");
await p.locator("[data-testid='sbr-tr-submit']").click(); await settle();
check("valid treatment saved, form closed", (await p.locator("[data-testid='sbr-treatment-form']").count()) === 0);
// treatment report tab
await p.goto(`${BASE}/dashboard/purchase/stock/report`, { waitUntil: "load", timeout: 240000 }); await p.waitForSelector("[data-testid='sbr-cards']"); await settle();
await p.locator("[data-testid='sbr-cards'] > *").nth(4).click(); await settle();
check("treatment appears in the Treatment report", (await p.locator("[data-testid='sbr-treatment-row']").count()) > 0, await p.locator("[data-testid='sbr-treatment-row']").count());
await p.screenshot({ path: `${OUT}/${LANG}-treatment-report.png` });
await p.locator("[data-testid='sbr-treatment-row']:not(.line-through) [data-testid='sbr-edit-treatment']").first().click(); await settle();
await p.locator("[data-testid='sbr-up-treated']").fill("1"); await p.locator("[data-testid='sbr-up-submit']").click(); await settle();
check("update modal closes after save", (await p.locator("[data-testid='sbr-update-form']").count()) === 0);
await p.locator("[data-testid='sbr-treatment-row']:not(.line-through) [data-testid='sbr-cancel-treatment']").first().click(); await settle();
await p.locator("[data-testid='sbr-cancel-reason']").fill("UI test cleanup"); await p.locator("[data-testid='sbr-cancel-submit']").click(); await settle();
check("cancel modal closes after save", (await p.locator("[data-testid='sbr-cancel-form']").count()) === 0);
check("cancelled row struck through", (await p.locator("[data-testid='sbr-treatment-row'].line-through").count()) > 0);
check("no page/console errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await b.close(); console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed`);
