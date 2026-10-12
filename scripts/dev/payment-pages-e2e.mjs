/**
 * Authenticated browser E2E of the ten Journal payment pages (DEV only).
 *   BASE=http://localhost:3300 OUT=<dir> [ROLE=country_admin COUNTRY_ID=<uuid>] [PAGES=p_advance,...] node scripts/dev/payment-pages-e2e.mjs
 * For every page it checks: approved header (3 cards, title, breadcrumb), no page/console errors, no horizontal overflow, page search,
 * the existing Filters panel, date range, the three-dot menu, Excel (CSV) export against the real rows, and the Print / PDF preview.
 * Writes <OUT>/e2e-results.json and prints PASS/FAIL per check.
 */
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3300";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; if (!OUT) throw new Error("OUT required"); fs.mkdirSync(OUT, { recursive: true });
const ROLE = process.env.ROLE || "super_admin";
const PAGES = {
  p_advance: ["/dashboard/journal/purchase-order-payment/advance", "Advance Payment"],
  p_endorsement: ["/dashboard/journal/purchase-order-payment/endorsement", "Endorsement Payment"],
  p_credit: ["/dashboard/journal/purchase-order-payment/charges", "Credit Payment"],
  p_remaining: ["/dashboard/journal/purchase-order-payment/remaining", "Remaining Payment"],
  p_history: ["/dashboard/journal/purchase-order-payment/history", "Purchase Payment History"],
  p_final: ["/dashboard/journal/purchase-order-payment/final", "Final Payment"],
  s_advance: ["/dashboard/journal/sales-order-payment/advance", "Advance Payment / Receipt"],
  s_credit: ["/dashboard/journal/sales-order-payment/charges", "Credit Payment / Receipt"],
  s_remaining: ["/dashboard/journal/sales-order-payment/remaining", "Remaining Payment / Recovery"],
  s_history: ["/dashboard/journal/sales-order-payment/history", "Sales Payment History"],
};
const keys = (process.env.PAGES ? process.env.PAGES.split(",") : Object.keys(PAGES));

const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: ROLE, countryId: process.env.COUNTRY_ID || undefined }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const browser = await chromium.launch();
const results = [];
const check = (page, name, ok, detail = "") => { results.push({ page, name, ok: !!ok, detail: String(detail).slice(0, 200) }); console.log(ok ? "PASS" : "FAIL", page, "·", name, detail ? "· " + String(detail).slice(0, 120) : ""); };

for (const key of keys) {
  const [route, title] = PAGES[key];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.addCookies([{ name: "erp_session", value: token, domain: new URL(BASE).hostname, path: "/" }, { name: "erp_lang", value: "en", domain: new URL(BASE).hostname, path: "/" }]);
  await ctx.addInitScript(() => { try { localStorage.setItem("erp_lang", "en"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource|hydrat|ResizeObserver|Download the React DevTools/i.test(m.text())) errors.push("console: " + m.text().slice(0, 160)); });
  try {
    await p.goto(BASE + route, { waitUntil: "load", timeout: 240000 });
    await p.waitForSelector(".dgt-pa-cards", { timeout: 120000 });
    await p.waitForFunction(() => /\d/.test(document.querySelector(".dgt-pa-rows")?.innerText || ""), null, { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(6000);

    check(key, "approved header: exactly 3 cards", (await p.locator(".dgt-pa-card").count()) === 3);
    const h1 = (await p.locator(".dgt-pa h1").first().innerText()).trim();
    check(key, "page title", h1.length > 0 && h1.toLowerCase().includes(title.split(" / ")[0].toLowerCase()), `"${h1}" vs "${title}"`);
    check(key, "no old V2 header / duplicate headers", (await p.locator(".dgt-pa").count()) === 1);
    check(key, "no horizontal page overflow", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

    // page search narrows the register, clearing restores it
    // "of N entries/records": the LAST match inside the register card (the footer carries the real total)
    const countText = async () => (await p.evaluate(() => {
      const all = [...((document.querySelector(".dgt-purchase-table-skin") || document.body).innerText || "").matchAll(/of\s+(\d+)\s+(?:entries|records)/gi)];
      return all.length ? all[all.length - 1][1] : null;
    }));
    await p.waitForFunction(() => { const t = (document.querySelector(".dgt-purchase-table-skin")?.innerText || "").match(/ofs+(d+)s+(?:entries|records)/i); return t && Number(t[1]) > 0; }, null, { timeout: 60000 }).catch(() => {});
    const before = await countText();
    await p.fill(".dgt-pa-search input", "zzzz-no-such-record-zzzz");
    await p.waitForTimeout(1200);
    const none = await countText();
    await p.fill(".dgt-pa-search input", "");
    await p.waitForTimeout(1200);
    const after = await countText();
    check(key, "page search narrows and restores the register", before !== null && none === "0" && after === before, `before=${before} none=${none} after=${after}`);

    // existing Filters panel (modal on nine pages, popover with the page's own selects on Remaining Payment)
    const popFilters = p.locator(".dgt-pa-pop summary", { hasText: /filters?/i });
    if (await popFilters.count()) {
      await popFilters.first().click();
      await p.waitForTimeout(600);
      check(key, "Filters opens the page's existing filter selects", (await p.locator(".dgt-pa-pop-panel select").count()) >= 2);
      await popFilters.first().click();
    } else {
      await p.getByRole("button", { name: /filters?/i }).first().click();
      await p.waitForTimeout(800);
      check(key, "Filters opens the existing filter panel", await p.evaluate(() => /apply filters/i.test(document.body.innerText)));
      await p.getByRole("button", { name: /apply filters/i }).first().click().catch(() => {});
      await p.waitForTimeout(800);
    }

    check(key, "date range control present", (await p.locator(".dgt-pa-date").count()) === 1);

    // three-dot menu + CSV export vs the real row count
    const menuBtn = p.locator("summary[aria-label]").last();
    await menuBtn.click();
    const items = await p.locator("details.dgt-pa-pop[open] .dgt-pa-pop-panel .dgt-pa-menu-item").allInnerTexts();
    check(key, "three-dot menu has Print/PDF + Excel (+ Banking Balance)", items.length >= 2 && /print/i.test(items[0]) && /excel/i.test(items[1]), items.join(" | "));
    const rowsBefore = await countText();
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }).catch(() => null), p.locator("details.dgt-pa-pop[open] .dgt-pa-pop-panel .dgt-pa-menu-item").nth(1).click()]);
    if (dl) {
      const file = `${OUT}/${key}-${dl.suggestedFilename()}`;
      await dl.saveAs(file);
      const lines = fs.readFileSync(file, "utf8").trim().split("\n").length - 1;
      check(key, "Excel (CSV) export = the real rows on screen", rowsBefore !== null && lines === Number(rowsBefore), `csv rows=${lines} on-screen=${rowsBefore}`);
    } else check(key, "Excel (CSV) export downloads", false, "no download");

    // Print / PDF preview with real data
    await menuBtn.click();
    await p.locator("details.dgt-pa-pop[open] .dgt-pa-pop-panel .dgt-pa-menu-item").nth(0).click();
    await p.waitForTimeout(8000);
    const previewText = await p.evaluate(() => document.body.innerText);
    check(key, "Print / PDF preview opens with the journal", /journal/i.test(previewText) && (await p.locator("iframe").count()) >= 1);
    await p.screenshot({ path: `${OUT}/${key}-print-preview.png` });

    check(key, "no page / console errors", errors.length === 0, errors[0] || "");
  } catch (e) {
    check(key, "page ran to completion", false, String(e));
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/e2e-results.json`, JSON.stringify(results, null, 1));
const bad = results.filter((x) => !x.ok);
console.log(`\n==== ${results.length - bad.length} PASS / ${bad.length} FAIL ====`);
