// DEV-only: take viewport screenshots of routes at desktop / laptop / phone sizes, for visual design review. Saves nothing in the ERP.
// Env: BASE, RBAC_SECRET, ROUTES (comma list), OUT, SIZES (comma of key), THEMES (day,night,system), LANGS, FULL=1 (full-page), WAIT (ms extra)
import fs from "node:fs";
import { webkit } from "playwright";

const BASE = process.env.BASE || "http://localhost:3230";
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const ROUTES = (process.env.ROUTES || "/dashboard/users").split(",");
const THEMES = (process.env.THEMES || "day").split(",");
const LANGS = (process.env.LANGS || "en").split(",");
const ALL = {
  desktop: { w: 1440, h: 900, touch: false }, macbook: { w: 1280, h: 800, touch: false }, large: { w: 1920, h: 1080, touch: false },
  laptop: { w: 1366, h: 768, touch: false }, iphone: { w: 393, h: 852, touch: true, mobile: true }, ipad: { w: 820, h: 1180, touch: true, mobile: true },
  "ipad-land": { w: 1180, h: 820, touch: true, mobile: true },
};
const SIZES = (process.env.SIZES || "desktop").split(",");
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const lr = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "rbac.super@rbac-test.dev", password }), redirect: "manual" });
const token = lr.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await webkit.launch();
for (const sz of SIZES) for (const theme of THEMES) for (const lang of LANGS) {
  const S = ALL[sz];
  const ctx = await b.newContext({ viewport: { width: S.w, height: S.h }, deviceScaleFactor: 1, isMobile: !!S.mobile, hasTouch: !!S.touch, colorScheme: theme === "system" ? "dark" : "light" });
  await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }, { name: "erp_theme_mode", value: theme, domain: "localhost", path: "/" }]);
  await ctx.addInitScript(([t, l]) => { try { localStorage.setItem("erp_theme_mode", t); localStorage.setItem("erp_lang", l); } catch {} }, [theme, lang]);
  for (const r of ROUTES) {
    const p = await ctx.newPage();
    try {
      await p.goto(BASE + r, { waitUntil: "load", timeout: 90000 });
      await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      if (process.env.INJECT_CSS) await p.addStyleTag({ content: fs.readFileSync(process.env.INJECT_CSS, "utf8") });
      if (process.env.INJECT_CSS2) await p.addStyleTag({ content: fs.readFileSync(process.env.INJECT_CSS2, "utf8") });
      if (process.env.EVAL) await p.evaluate(process.env.EVAL);
      await p.waitForTimeout(Number(process.env.WAIT || 2500));
      for (let i = 0; i < 20; i++) { const sl = await p.evaluate(() => [...document.querySelectorAll(".animate-spin")].some((el) => el.getBoundingClientRect().width > 0)).catch(() => false); if (!sl) break; await p.waitForTimeout(2000); }
      const f = `${OUT}/${r.replace(/[^a-z0-9]+/gi, "_")}-${sz}-${theme}-${lang}.png`;
      await p.screenshot({ path: f, fullPage: process.env.FULL === "1" });
      console.log("shot", f);
    } catch (e) { console.log("FAIL", r, String(e).slice(0, 100)); }
    await p.close();
  }
  await ctx.close();
}
await b.close();
