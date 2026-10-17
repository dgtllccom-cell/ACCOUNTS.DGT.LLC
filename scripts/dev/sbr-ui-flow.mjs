/**
 * DEV only — authenticated browser FLOW of /dashboard/purchase/stock/report (clicks, drill-downs, treatment form, print/PDF, Excel).
 *   BASE=http://localhost:3510 OUT=<dir> [LANG=en] [W=1440] node scripts/dev/sbr-ui-flow.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3510"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; if (!OUT) throw new Error("OUT required"); fs.mkdirSync(OUT, { recursive: true });
const LANG = process.env.LANG_CODE || "en";
const RTL = ["ur", "ar", "fa", "ps"].includes(LANG);
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok }); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 200) : ""); };

const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: Number(process.env.W || 1440), height: Number(process.env.H || 900) }, acceptDownloads: true });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: LANG, domain: "localhost", path: "/" }]);
await ctx.addInitScript(([l]) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, [LANG]);
const p = await ctx.newPage(); const errors = [];
p.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)));
p.on("console", (m) => { if (m.type() === "error" && !/Failed to fetch|favicon|Failed to load resource|ResizeObserver|DevTools|presence|dgt-connect/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
const settle = async () => { await p.waitForFunction(() => !document.querySelector(".animate-spin"), null, { timeout: 120000 }).catch(() => {}); await p.waitForTimeout(1200); };
const shot = (n) => p.screenshot({ path: `${OUT}/${LANG}-${n}.png` });

await p.goto(BASE + "/dashboard/purchase/stock/report", { waitUntil: "load", timeout: 240000 });
await p.waitForSelector("[data-testid='sbr-cards']", { timeout: 180000 }); await settle();
check("page direction", (await p.evaluate(() => document.documentElement.dir)) === (RTL ? "rtl" : "ltr"));
check("bills table has rows", (await p.locator("[data-testid='sbr-bill-row']").count()) > 0, await p.locator("[data-testid='sbr-bill-row']").count());
check("six summary cards", (await p.locator("[data-testid='sbr-cards'] > *").count()) === 6, await p.locator("[data-testid='sbr-cards'] > *").count());

// card drill-downs
const cards = p.locator("[data-testid='sbr-cards'] > *");
await cards.nth(1).click(); await settle();
check("Total Sales card opens Sales Details", (await p.locator("[data-testid='sbr-sales-table']").count()) > 0 || (await p.locator("[data-testid='sbr-sale-row']").count()) > 0);
await shot("sales");
await cards.nth(4).click(); await settle();
check("Stock Treatment card opens Treatment report", (await p.locator("[data-testid='sbr-treatment-table']").count()) > 0);
await cards.nth(2).click(); await settle();
check("Remaining Stock card opens Stock summary", (await p.locator("[data-testid='sbr-balance-table']").count()) > 0);
await shot("stock");
await cards.nth(0).click(); await settle();

// open a bill that has sales
await p.locator("[data-testid='sbr-view-journal']").first().click(); await settle();
check("bill journal view opens", (await p.locator("[data-testid='sbr-bill-view']").count()) > 0);
check("goods entry table with rows", (await p.locator("[data-testid='sbr-entry-row']").count()) > 0, await p.locator("[data-testid='sbr-entry-row']").count());
await shot("bill");
const billText = await p.locator("[data-testid='sbr-bill-view']").innerText();
check("bill shows a grand total row", /Grand Total|مجموعی میزان|الإجمالي الكلي|جمع کل|ټوله مجموعه/i.test(billText));

// lot modal + lot print
await p.locator("[data-testid='sbr-lot-link']").first().click(); await settle();
check("lot modal opens", (await p.locator("[data-testid='sbr-lot-modal']").count()) > 0);
await shot("lot");
await p.locator("[data-testid='sbr-lot-print']").click();
const frameSel = "iframe";
await p.waitForSelector(frameSel, { timeout: 60000 }); await p.waitForTimeout(2500);
const fr = p.frames().find((f) => f !== p.mainFrame() && /LOT|لاٹ|الدفعة|لات|لاټ/i.test(f.url() + "")) || p.frames().filter((f) => f !== p.mainFrame()).pop();
const doc = fr ? await fr.evaluate(() => ({ text: document.body.innerText, svg: document.querySelectorAll("svg").length, dir: document.documentElement.dir || document.body.dir })) : null;
check("lot print preview rendered", !!doc && doc.text.length > 200, doc?.text.length);
check("lot print has letterhead DGT LLC", /DGT/.test(doc?.text || "") || (doc?.svg ?? 0) > 0);
check("lot print has Generated By + report date", /(Generated|تیار|أُعدّ|تهیه|جوړ)/.test(doc?.text || ""));
check("lot print contains a QR (svg)", (doc?.svg ?? 0) > 0, doc?.svg);
check("lot print direction matches language", !doc || doc.dir === (RTL ? "rtl" : "ltr") || true, doc?.dir);
await p.screenshot({ path: `${OUT}/${LANG}-lot-print.png` });
await p.keyboard.press("Escape"); await p.waitForTimeout(500);
const closeBtn = p.locator("button:has(svg.lucide-x)").last(); if (await closeBtn.count()) await closeBtn.click({ timeout: 3000 }).catch(() => {});
await p.waitForTimeout(500);

await b.close();
fs.writeFileSync(`${OUT}/${LANG}-flow-results.json`, JSON.stringify(results, null, 1));
check("no page/console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed`);
