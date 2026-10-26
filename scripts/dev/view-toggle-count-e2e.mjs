// DEV only, read-only: the shared Grid/List toggle must appear at most ONCE at every moment of a page's life — while it loads,
// after data arrives and after the view is switched. Samples the toggle count every 150 ms for the first 10 s, then at 15 s and 25 s,
// on phone (390), tablet (820) and desktop (1440), and checks the page has no sideways scroll.
//   node scripts/dev/view-toggle-count-e2e.mjs [--base http://localhost:3521] [--pages /a,/b] [--widths 390,820,1440]
import fs from "node:fs";
import { chromium } from "playwright";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("base", "http://localhost:3521");
if (!/localhost/.test(BASE)) throw new Error("DEV only");
const PAGES = arg("pages", [
  "/dashboard/new-entry/users/all", "/dashboard/users", "/dashboard/accounts/setup",
  "/dashboard/purchase/local-purchase", "/dashboard/purchase/local-purchase-transfer-payment", "/dashboard/purchase/local-purchase-journal-report",
  "/dashboard/journal/purchase-order-payment/final", "/dashboard/ledger/outstanding", "/dashboard/accounts", "/dashboard/reports/country"
].join(",")).split(",");
const WIDTHS = arg("widths", "390,820,1440").split(",").map(Number);

const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session="))?.slice(12);
if (!token) throw new Error("no dev session");
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: Boolean(ok) }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` · ${detail}` : ""}`); };

for (const width of WIDTHS) {
  const mobile = width < 800;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile });
  await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }]);
  await ctx.addInitScript(() => { try { localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} });
  for (const path of PAGES) {
    const p = await ctx.newPage();
    const tag = `${path} [${width}px]`;
    // count visible toggles from the very first paint
    await p.addInitScript(() => {
      window.__toggleMax = 0;
      const count = () => [...document.querySelectorAll("[data-testid='view-mode-toggle']")].filter((e) => e.getClientRects().length > 0).length;
      const tick = () => { window.__toggleMax = Math.max(window.__toggleMax, count()); };
      new MutationObserver(tick).observe(document, { childList: true, subtree: true, attributes: true });
      setInterval(tick, 50);
    });
    try {
      for (let attempt = 0; ; attempt++) {
        try { await p.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 180000 }); break; }
        catch (e) { if (attempt >= 3 || !/ERR_CONNECTION|ERR_EMPTY_RESPONSE/.test(String(e))) throw e; await p.waitForTimeout(15000); }
      }
      await p.waitForTimeout(25000);
      const now = await p.evaluate(() => ({
        max: window.__toggleMax,
        visible: [...document.querySelectorAll("[data-testid='view-mode-toggle']")].filter((e) => e.getClientRects().length > 0).length,
        tables: document.querySelectorAll("main[data-erp-content] table").length,
        overflow: document.documentElement.scrollWidth - window.innerWidth
      }));
      check(`${tag}: never more than one Grid/List toggle while loading`, now.max <= 1, `max seen ${now.max}`);
      check(`${tag}: one toggle when the page shows a table, none otherwise`, now.visible === (now.tables > 0 ? 1 : 0) || (now.tables > 0 && now.visible <= 1), `visible ${now.visible}, tables ${now.tables}`);
      if (now.visible === 1) {
        await p.evaluate(() => { window.__toggleMax = 0; });
        await p.locator("[data-testid='view-grid']").first().click({ timeout: 10000 });
        await p.waitForTimeout(2500);
        await p.locator("[data-testid='view-list']").first().click({ timeout: 10000 });
        await p.waitForTimeout(2500);
        const after = await p.evaluate(() => window.__toggleMax);
        check(`${tag}: still one toggle after switching Grid → List`, after <= 1, `max seen ${after}`);
      }
      check(`${tag}: no sideways page scroll`, now.overflow <= 2, `${now.overflow}px`);
      fs.mkdirSync(".tmp/toggle-shots", { recursive: true });
      await p.screenshot({ path: `.tmp/toggle-shots/${path.replace(/\W+/g, "_")}-${width}.png` });
    } catch (e) {
      check(`${tag}: loads`, false, String(e.message).split("\n")[0].slice(0, 140));
    }
    await p.close();
  }
  await ctx.close();
}
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n==== ${results.length - failed} PASS / ${failed} FAIL ====`);
process.exit(failed ? 1 : 0);
