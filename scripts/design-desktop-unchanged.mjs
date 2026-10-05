// DEV-only proof that the mobile/tablet template changes NOTHING on desktop: on a 1440px mouse screen, hash every
// computed style of the page, delete every rule that comes from app/design-system.css, hash again, compare.
import fs from "node:fs"; import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3230";
const PATHS = (process.env.PATHS || "/dashboard/new-entry/users/registration").split(",");
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const res = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "rbac.super@rbac-test.dev", password }), redirect: "manual" });
const token = (res.headers.getSetCookie() || []).map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch();
for (const theme of ["day", "night"]) for (const p of PATHS) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_theme_mode", value: theme, domain: "localhost", path: "/" }]);
  await ctx.addInitScript((t) => localStorage.setItem("erp_theme_mode", t), theme);
  const page = await ctx.newPage();
  await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 180000 }); await page.waitForTimeout(1500);
  const out = await page.evaluate(() => {
    const hash = () => { let h = 0; const els = document.querySelectorAll("body *"); for (const el of els) { const s = getComputedStyle(el); const v = s.cssText || [...s].map((k) => s.getPropertyValue(k)).join(";"); for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) | 0; } return [h, els.length]; };
    const before = hash();
    let removed = 0;
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch { continue; }
      for (let i = rules.length - 1; i >= 0; i--) {
        const t = rules[i].cssText;
        if (t.includes('data-erp-theme-mode="system"]:not(.dark)') || (rules[i].media && /1023\.98px|639\.98px|1399\.98px/.test(rules[i].media.mediaText))) { sheet.deleteRule(i); removed++; }
      }
    }
    const after = hash();
    const touch = matchMedia("screen and (max-width: 1023.98px), screen and (pointer: coarse) and (max-width: 1399.98px)").matches;
    return { before, after, removed, touchQueryMatches: touch, identical: before[0] === after[0] };
  });
  console.log(theme, p, JSON.stringify(out));
  await ctx.close();
}
await b.close();
