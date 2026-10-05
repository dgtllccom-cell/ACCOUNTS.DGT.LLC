// DEV-only: open the first SearchSelect on a page (click text OPEN) and report the popover's box + any descendant that pokes past it
import fs from "node:fs";
import { webkit } from "playwright";
const BASE = process.env.BASE || "http://localhost:3230";
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const lr = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "rbac.super@rbac-test.dev", password }), redirect: "manual" });
const token = lr.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const W = Number(process.env.W || 393), H = Number(process.env.H || 852);
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: process.env.LANG_CODE || "en", domain: "localhost", path: "/" }]);
const p = await ctx.newPage();
await p.goto(BASE + process.env.PAGE_PATH, { waitUntil: "load", timeout: 120000 });
await p.waitForSelector("[data-erp-content] button", { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(4000);
await p.locator("button, [role=combobox]", { hasText: process.env.OPEN }).first().click({ timeout: 20000 });
await p.waitForTimeout(2000);
const out = await p.evaluate(() => {
  const pop = document.querySelector("[data-radix-popper-content-wrapper] > *") || document.querySelector("[role=dialog][data-state=open]");
  if (!pop) return "no popover";
  const pr = pop.getBoundingClientRect();
  const bad = [...pop.querySelectorAll("*")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > pr.right + 1; }).slice(0, 8)
    .map((e) => `${e.tagName.toLowerCase()}.${(e.className || "").toString().split(" ").slice(0, 5).join(".")} r=${Math.round(e.getBoundingClientRect().right)} w=${Math.round(e.getBoundingClientRect().width)}`);
  const root = pop.querySelector("[cmdk-root]"); const cs = root && getComputedStyle(root); const rules = []; if (root) for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) { const walk = (rs) => { for (const x of rs) { if (x.cssRules && !x.selectorText) walk(x.cssRules); else if (x.selectorText && root.matches(x.selectorText) && /(^|;|\s)(min-)?width\s*:/.test(x.cssText)) rules.push((x.parentRule && x.parentRule.conditionText ? "@media " + x.parentRule.conditionText.slice(0, 40) + " " : "") + x.cssText.slice(0, 170)); } }; walk([r]); } } catch (e) {} } return { rootw: cs && [cs.width, cs.minWidth, cs.maxWidth], rules: rules.slice(0, 6), popover: { l: Math.round(pr.left), r: Math.round(pr.right), w: Math.round(pr.width), cls: (pop.className || "").toString().slice(0, 140) }, vw: innerWidth, bad };
});
console.log(JSON.stringify(out, null, 1));
if (process.env.CLICK) { try { await p.locator(process.env.CLICK).first().click({ timeout: 6000 }); console.log("CLICK ok"); } catch (e) { console.log("CLICK FAIL", String(e).slice(0, 900)); } }
await p.screenshot({ path: process.env.SHOT || "C:/Users/dgtll/AppData/Local/Temp/rs/popover.png" });
await b.close();
