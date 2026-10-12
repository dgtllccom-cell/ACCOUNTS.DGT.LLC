/**
 * DEV-only authenticated screenshots of the Cash Journal (Roznamcha cash entry) screens.
 *   BASE=http://localhost:3300 OUT=<dir> [ROLE=super_admin|country_admin|branch_admin COUNTRY_ID=.. COUNTRY_BRANCH_ID=.. CITY_BRANCH_ID=..]
 *   PATHS=/dashboard/roznamcha/cash-entry,... LANGS=en,ur DEVICES=desktop,ipad,samsung,iphone THEMES=light,dark FULL=1 node scripts/dev/cash-shots.mjs
 * Writes <OUT>/<slug>-<device>-<lang>-<theme>.png and prints overflow / page-error info per shot.
 */
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3300";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; if (!OUT) throw new Error("OUT required"); fs.mkdirSync(OUT, { recursive: true });
const DEVICES = {
  desktop: { w: 1440, h: 900, dpr: 1, mobile: false },
  laptop: { w: 1366, h: 768, dpr: 1, mobile: false },
  ipad: { w: 820, h: 1180, dpr: 2, mobile: true },
  samsung: { w: 412, h: 915, dpr: 2.6, mobile: true },
  iphone: { w: 390, h: 844, dpr: 3, mobile: true },
};
const pick = (env, all) => (process.env[env] ? process.env[env].split(",") : all);
const paths = pick("PATHS", ["/dashboard/roznamcha/cash-entry"]);
const langs = pick("LANGS", ["en"]), devices = pick("DEVICES", ["desktop"]), themes = pick("THEMES", ["light"]);
const FULL = process.env.FULL === "1";
const body = { role: process.env.ROLE || "super_admin", countryId: process.env.COUNTRY_ID || undefined, countryBranchId: process.env.COUNTRY_BRANCH_ID || undefined, cityBranchId: process.env.CITY_BRANCH_ID || undefined, operationalDomain: process.env.DOMAIN || undefined };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const browser = await chromium.launch();
const summary = [];
for (const dev of devices) {
  const D = DEVICES[dev];
  for (const theme of themes) {
    const ctx = await browser.newContext({ viewport: { width: D.w, height: D.h }, deviceScaleFactor: D.dpr, isMobile: D.mobile, hasTouch: D.mobile, colorScheme: theme });
    for (const lang of langs) {
      await ctx.clearCookies();
      await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
      await ctx.addInitScript(([l, t]) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); localStorage.setItem("theme", t); } catch {} }, [lang, theme]);
      for (const path of paths) {
        const slug = path.replace(/^\/dashboard\//, "").replace(/[^a-z0-9]+/gi, "_");
        const page = await ctx.newPage(); const errors = [];
        page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
        try {
          await page.goto(BASE + path, { waitUntil: "load", timeout: 240000 });
          await page.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => {});
          if (theme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark")).catch(() => {});
          await page.waitForTimeout(Number(process.env.SETTLE || 6000));
          if (process.env.CLICK_SEL) { await page.locator(process.env.CLICK_SEL).first().click({ timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500); }
          if (process.env.WAIT_ROWS === "1") await page.waitForFunction(() => /of [1-9]/.test(document.querySelector(".dgt-cj-pager")?.innerText || ""), null, { timeout: 90000 }).catch(() => {});
          await page.waitForFunction(() => !document.querySelector("td[colspan=\"13\"].italic"), null, { timeout: 90000 }).catch(() => {});
          await page.waitForTimeout(1500);
          const file = `${OUT}/${slug}-${dev}-${lang}-${theme}.png`;
          await page.screenshot({ path: file, fullPage: FULL });
          const m = await page.evaluate(() => ({ dir: document.documentElement.dir, overflowX: document.documentElement.scrollWidth > innerWidth + 1, h1: document.querySelector("h1,h2")?.textContent?.trim().slice(0, 60) }));
          summary.push({ path, dev, lang, theme, ...m, errors: errors.length });
          console.log("ok", slug, dev, lang, theme, JSON.stringify(m), errors.length ? "ERR " + errors[0] : "");
        } catch (e) { console.log("FAIL", slug, dev, lang, theme, String(e).slice(0, 100)); }
        await page.close();
      }
    }
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 1));
