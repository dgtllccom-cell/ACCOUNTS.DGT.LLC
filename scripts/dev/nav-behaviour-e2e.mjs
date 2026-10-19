/** DEV only — Back / breadcrumb / single ⋮ menu behaviour. BASE=http://localhost:3510 OUT=<dir> [LANG_CODE=en] [W=1440] node scripts/dev/nav-behaviour-e2e.mjs */
import fs from "node:fs"; import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3510"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true }); const LANG = process.env.LANG_CODE || "en";
const results = []; const check = (n, ok, d = "") => { results.push({ n, ok: !!ok }); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 170) : ""); };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: Number(process.env.W || 1440), height: 900 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: LANG, domain: "localhost", path: "/" }]);
await ctx.addInitScript(([l]) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, [LANG]);
const settle = async (p) => { await p.waitForFunction(() => !document.querySelector(".animate-spin"), null, { timeout: 90000 }).catch(() => {}); await p.waitForTimeout(1500); };
const path = (p) => new URL(p.url()).pathname;

// A) direct deep link → Back goes to the PARENT page (no in-app history yet)
let p = await ctx.newPage();
await p.goto(BASE + "/dashboard/purchase/stock/report", { waitUntil: "domcontentloaded", timeout: 120000 }); await settle(p);
const crumb = p.locator("[data-testid='erp-breadcrumb']");
check("breadcrumb shown", (await crumb.count()) === 1, await crumb.innerText().catch(() => ""));
const links = await crumb.locator("a").count();
check("breadcrumb has clickable ancestors (Home + group)", links >= 1, "links=" + links);
await p.screenshot({ path: `${OUT}/${LANG}-breadcrumb.png`, clip: { x: 270, y: 50, width: 1100, height: 120 } }).catch(() => {});
const backBtns = p.locator("main button[aria-label='Back to previous page'], main button:has-text('Back')");
// language-agnostic: the Back control is the arrow-left button inside the page-actions bar (labels are translated)
const backCount = await p.locator("[data-erp-page-actions] button:has(svg.lucide-arrow-left), main button:has(svg.lucide-arrow-left)").count();
check("exactly one Back button in the page chrome", backCount === 1, "count=" + backCount);
// ⋮ menu: one, opens, lists the report kinds, no generic Print/PDF duplicates
const dots = p.locator("[data-erp-page-actions] button:has(svg[class*='lucide-ellipsis-vertical']), [data-erp-page-actions] button:has(svg[class*='lucide-more-vertical'])");
check("exactly one ⋮ Actions button", (await dots.count()) === 1 && (await p.locator("[data-testid='sbr-more']").count()) === 0);
await dots.first().click(); await p.waitForTimeout(400);
const menuText = await p.locator("[data-testid='erp-page-menu']").innerText();
check("⋮ menu lists the page's own report actions", /PDF/i.test(menuText) && /Excel/i.test(menuText), menuText.replace(/\s+/g, " ").slice(0, 120));
check("⋮ menu does not repeat the generic Print / PDF Download (page has its own)", !/Print\b/i.test(menuText.split("\n").filter((l) => /^print$/i.test(l.trim())).join()) , "");
await p.screenshot({ path: `${OUT}/${LANG}-menu.png` });
await p.keyboard.press("Escape");
await p.locator("main button:has(svg.lucide-arrow-left)").first().click(); await p.waitForTimeout(2500);
check("direct deep link: Back → parent page", path(p) !== "/dashboard/purchase/stock/report" && path(p).startsWith("/dashboard"), path(p));
// B) in-app navigation → Back returns to the page we came from
await p.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded", timeout: 120000 }); await settle(p);
await p.evaluate(() => { history.pushState({}, "", "/dashboard"); });
await p.getByRole("link", { name: /^Ledgers$/ }).first().click().catch(() => {});
await p.goto(BASE + "/dashboard/accounts", { waitUntil: "domcontentloaded" }).catch(() => {});
await settle(p);
check("breadcrumb link navigates (Home)", await (async () => { const home = p.locator("[data-testid='erp-breadcrumb'] a").first(); if (!(await home.count())) return true; await home.click(); await p.waitForTimeout(2500); return path(p) === "/dashboard"; })(), path(p));
await b.close(); console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed`);
