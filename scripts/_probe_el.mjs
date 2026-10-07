// DEV-only: after STEPS, report the ancestor chain (overflow, widths) for elements whose text matches PROBE
import fs from "node:fs";
import { webkit } from "playwright";
const BASE = "http://localhost:3000";
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const lr = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "rbac.super@rbac-test.dev", password }), redirect: "manual" });
const token = lr.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const W = Number(process.env.W || 375), H = Number(process.env.H || 667);
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_theme_mode", value: "day", domain: "localhost", path: "/" }]);
const p = await ctx.newPage();
await p.goto(BASE + process.env.PAGE_PATH, { waitUntil: "networkidle", timeout: 240000 });
await p.waitForSelector("[data-erp-content] button", { timeout: 180000 }).catch(() => {});
await p.waitForTimeout(2500);
for (const st of JSON.parse(process.env.STEPS || "[]")) { await p.locator("button, a, [role=button]", { hasText: st }).first().click({ timeout: 20000 }); await p.waitForTimeout(3000); }
const out = await p.evaluate((q) => {
  const el = [...document.querySelectorAll("button, a")].find((e) => (e.textContent || "").trim() === q);
  if (!el) return "not found";
  const chain = []; for (let n = el; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n), r = n.getBoundingClientRect(); chain.push(`${n.tagName.toLowerCase()}.${(n.className || "").toString().split(" ").slice(0, 6).join(".")} ox=${cs.overflowX} flex=${cs.flexWrap} w=${Math.round(r.width)} sw=${n.scrollWidth} l=${Math.round(r.left)} r=${Math.round(r.right)}`); if (chain.length > 7) break; }
  return chain;
}, process.env.PROBE);
console.log(JSON.stringify(out, null, 1));
await b.close();
