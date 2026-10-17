/**
 * DEV only — count visible Back buttons and ⋮ (three-dot) menus on every sidebar destination.
 *   BASE=http://localhost:3510 OUT=<dir> [ROLE=super_admin] [W=1440] [ONLY=/dashboard/x,/dashboard/y] node scripts/dev/nav-chrome-audit.mjs
 * A page is OK when it shows exactly one Back and at most one ⋮ menu inside the main content area (the global bar counts as one).
 */
import fs from "node:fs"; import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3510"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const src = fs.readFileSync("components/layout/digital-dock-premium-sidebar.tsx", "utf8");
let hrefs = [...new Set([...src.matchAll(/href:\s*"(\/dashboard[^"?#]*)"/g)].map((m) => m[1]))].filter((h) => !/\[|:/.test(h)).sort();
if (process.env.ONLY) hrefs = process.env.ONLY.split(",");
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: process.env.ROLE || "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: Number(process.env.W || 1440), height: 900 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: process.env.LANG_CODE || "en", domain: "localhost", path: "/" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} });
const BACK = /^(back|go back|back to .*|واپس|پیچھے|رجوع|عودة|بازگشت|شاته|بیرته|← .*)$/i;
const rows = [];
for (const h of hrefs) {
  const p = await ctx.newPage();
  try {
    await p.goto(BASE + h, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.waitForFunction(() => !document.querySelector(".animate-spin") && !/Loading (Report|report|...)/.test(document.body.innerText.slice(0, 4000)), null, { timeout: Number(process.env.WAIT || 90000) }).catch(() => {});
    await p.waitForTimeout(2000);
    const m = await p.evaluate((BACKSRC) => {
      const BACK = new RegExp(BACKSRC, "i");
      const main = document.querySelector("main") || document.body;
      const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
      const inSidebar = (e) => !!e.closest("aside, nav, [data-sidebar]");
      const topY = main.getBoundingClientRect().top + window.scrollY;
      // page-level chrome only: the first screenful of the content area and never inside a table / list row (row ⋮ menus are per-record and fine)
      const pageLevel = (e) => { const r = e.getBoundingClientRect(); return r.top + window.scrollY - topY < 280 && !e.closest("table, tbody, [role=row], li, [data-record-row]"); };
      const btns = [...main.querySelectorAll("button, a, [role=button]")].filter((e) => vis(e) && !inSidebar(e) && pageLevel(e));
      const label = (e) => (e.getAttribute("aria-label") || e.getAttribute("title") || e.textContent || "").trim().replace(/\s+/g, " ");
      const backs = btns.filter((e) => BACK.test(label(e)) || /back/i.test(e.getAttribute("aria-label") || "") || (e.querySelector("svg.lucide-arrow-left, svg.lucide-chevron-left") && label(e).length < 24 && /back|واپس|رجوع|بازگشت|شاته/i.test(label(e) + (e.getAttribute("aria-label") || ""))));
      const dots = btns.filter((e) => e.querySelector("svg.lucide-more-vertical, svg.lucide-ellipsis-vertical, svg.lucide-more-horizontal, svg.lucide-ellipsis") && label(e).length < 30 || /^(actions|⋮|more)$/i.test(label(e)) || /page actions|open page actions/i.test(e.getAttribute("aria-label") || ""));
      return { backs: backs.map(label).slice(0, 5), dots: dots.map(label).slice(0, 5), globalBar: !!document.querySelector("[data-erp-page-actions]"), title: document.title.slice(0, 50) };
    }, BACK.source);
    rows.push({ href: h, back: m.backs.length, dots: m.dots.length, globalBar: m.globalBar, backs: m.backs, dotsL: m.dots });
    console.log(`${m.backs.length > 1 || m.dots.length > 1 ? "DUP " : "ok  "} ${h}  back=${m.backs.length} dots=${m.dots.length} bar=${m.globalBar}`);
  } catch (e) { rows.push({ href: h, error: String(e).slice(0, 80) }); console.log("ERR ", h, String(e).slice(0, 60)); }
  await p.close();
}
fs.writeFileSync(`${OUT}/nav-audit.json`, JSON.stringify(rows, null, 1));
const dup = rows.filter((x) => x.back > 1 || x.dots > 1);
console.log(`\n${rows.length} pages, ${dup.length} with duplicate Back/⋮, ${rows.filter((x) => x.error).length} errors`);
await b.close();
