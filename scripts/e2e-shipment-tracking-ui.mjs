/**
 * Shipment Tracking — authenticated UI checks (DEV ONLY).
 *
 *   BASE=http://localhost:3530 OUT=<screenshot dir> node scripts/e2e-shipment-tracking-ui.mjs
 *   optional: PATHS=/dashboard/shipping-line/tracking,... LANGS=en,ur DEVICES=desktop,laptop,ipad,iphone STRICT=0
 *
 * For every device x language it opens the tracking page with a real dev-session cookie and checks:
 *   - no page errors, no horizontal page scroll
 *   - the page lays out in the language direction (RTL for ur/ar/fa/ps)
 *   - the sidebar menu entry for the page is red (owner request)
 *   - the list shows real records (or an honest empty state) and a row opens the detail (panel / sheet)
 *   - the detail close control, tabs and the Add-event dialog are reachable by keyboard-accessible roles
 * and saves a screenshot per state. Exit code 1 when any check fails.
 */
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3530";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT;
if (!OUT) throw new Error("OUT required");
fs.mkdirSync(OUT, { recursive: true });

const DEVICES = {
  desktop: { w: 1440, h: 900, dpr: 1, mobile: false },
  laptop: { w: 1280, h: 720, dpr: 1, mobile: false },
  ipad: { w: 820, h: 1180, dpr: 2, mobile: true },
  iphone: { w: 390, h: 844, dpr: 3, mobile: true },
};
const pick = (env, all) => (process.env[env] ? process.env[env].split(",") : all);
const paths = pick("PATHS", ["/dashboard/shipping-line/tracking"]);
const langs = pick("LANGS", ["en", "ur"]);
const devices = pick("DEVICES", ["desktop", "laptop", "ipad", "iphone"]);
const RTL = new Set(["ur", "ar", "fa", "ps"]);

const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
if (!r.ok) throw new Error("dev-session failed " + r.status);
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);

const results = [];
function check(scope, name, ok, detail = "") {
  results.push({ scope, name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${scope}] ${name}${!ok && detail ? "  -> " + detail : ""}`);
}

const browser = await chromium.launch();
for (const dev of devices) {
  const D = DEVICES[dev];
  const ctx = await browser.newContext({ viewport: { width: D.w, height: D.h }, deviceScaleFactor: D.dpr, isMobile: D.mobile, hasTouch: D.mobile });
  for (const lang of langs) {
    await ctx.clearCookies();
    await ctx.addCookies([
      { name: "erp_session", value: token, domain: "localhost", path: "/" },
      { name: "erp_lang", value: lang, domain: "localhost", path: "/" },
    ]);
    await ctx.addInitScript((l) => {
      try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {}
    }, lang);
    for (const path of paths) {
      const slug = path.replace(/^\/dashboard\//, "").replace(/[^a-z0-9]+/gi, "_");
      const scope = `${dev}/${lang}/${slug}`;
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
      try {
        await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 180000 });
        await page.waitForSelector("[data-shtrk-root] h1", { timeout: 120000 });
        // let the list settle (loading spinner gone)
        await page.waitForSelector("[data-shtrk-row], [data-shtrk-empty]", { timeout: 90000 }).catch(() => {});
        await page.waitForTimeout(800);

        const dir = await page.evaluate(() => document.querySelector("[data-shtrk-root]")?.getAttribute("dir") || document.documentElement.dir || "ltr");
        check(scope, `direction is ${RTL.has(lang) ? "rtl" : "ltr"}`, dir === (RTL.has(lang) ? "rtl" : "ltr"), `dir=${dir}`);

        const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        check(scope, "no horizontal page scroll (list)", ov.sw <= ov.cw + 1, `scrollWidth=${ov.sw} clientWidth=${ov.cw}`);
        await page.screenshot({ path: `${OUT}/${slug}-${dev}-${lang}-1-list.png`, fullPage: false });

        // sidebar entry red (only visible when the sidebar is rendered — desktop/laptop)
        if (!D.mobile) {
          const red = await page.evaluate((p) => {
            const a = document.querySelector(`aside a[href="${p}"], nav a[href="${p}"]`);
            if (!a) return "missing";
            const span = a.querySelector("span.truncate") || a;
            return getComputedStyle(span).color;
          }, path);
          // red-600 = rgb(220, 38, 38), active red-700 = rgb(185, 28, 28)
          check(scope, "sidebar menu entry is red", (() => { const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(red); return !!m && +m[1] >= 180 && +m[2] < 70 && +m[3] < 70; })(), `colour=${red}`);
        }

        const rowCount = await page.evaluate(() => document.querySelectorAll("[data-shtrk-row]").length);
        check(scope, "list renders rows or an empty state", rowCount > 0 || (await page.locator("[data-shtrk-empty]").count()) > 0, `rows=${rowCount}`);

        if (rowCount > 0) {
          await page.locator("[data-shtrk-row]:visible [data-shtrk-open]").first().click();
          await page.waitForSelector("[data-shtrk-detail]", { timeout: 60000 });
          await page.waitForFunction(() => !!document.querySelector("[data-shtrk-detail] [role=tablist]"), null, { timeout: 60000 });
          await page.waitForTimeout(400);
          const ov2 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
          check(scope, "no horizontal page scroll (detail open)", ov2.sw <= ov2.cw + 1, `scrollWidth=${ov2.sw} clientWidth=${ov2.cw}`);
          await page.screenshot({ path: `${OUT}/${slug}-${dev}-${lang}-2-detail.png`, fullPage: false });

          await page.locator("[data-shtrk-detail] [role=tab]").nth(1).click();
          await page.waitForTimeout(250);
          await page.screenshot({ path: `${OUT}/${slug}-${dev}-${lang}-3-journey.png`, fullPage: false });

          const add = page.locator("[data-shtrk-add-event]:visible");
          if (await add.count()) {
            await add.first().click();
            await page.waitForSelector("[role=dialog] form", { timeout: 15000 });
            const dlg = await page.evaluate(() => {
              const d = document.querySelector("[role=dialog] form")?.closest("[role=dialog]");
              if (!d) return null;
              const b = d.getBoundingClientRect();
              return { l: b.left, r: b.right, vw: innerWidth, label: !!d.getAttribute("aria-labelledby") || !!d.getAttribute("aria-label") };
            });
            check(scope, "Add-event dialog fits the viewport and is labelled", !!dlg && dlg.l >= -1 && dlg.r <= dlg.vw + 1 && dlg.label, JSON.stringify(dlg));
            await page.screenshot({ path: `${OUT}/${slug}-${dev}-${lang}-4-add-event.png`, fullPage: false });
            await page.keyboard.press("Escape");
            await page.waitForTimeout(300);
            check(scope, "Escape closes the dialog", (await page.locator("[role=dialog] form").count()) === 0);
          }

          // close control returns to the list
          await page.locator("[data-shtrk-close]:visible").first().click();
          await page.waitForTimeout(300);
          check(scope, "detail closes", (await page.locator("[data-shtrk-detail]:visible").count()) === 0);
        }
        check(scope, "no page errors", errors.length === 0, errors.join(" | "));
      } catch (e) {
        check(scope, "page flow completed", false, String(e).slice(0, 300));
        await page.screenshot({ path: `${OUT}/${slug}-${dev}-${lang}-FAILED.png` }).catch(() => {});
      }
      await page.close();
    }
  }
  await ctx.close();
}
await browser.close();

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed; screenshots in ${OUT}`);
process.exit(failed.length && process.env.STRICT !== "0" ? 1 : 0);
