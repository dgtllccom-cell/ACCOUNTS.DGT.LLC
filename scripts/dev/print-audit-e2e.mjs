/**
 * DEV only — print / PDF audit of the report-type pages: every page is opened (en + ur), switched to print media, and a real A4 PDF is generated.
 * Checks per page and language: renders (no error boundary), no page errors, sidebar + view toggle hidden in print, no sideways overflow in print,
 * the PDF has at least one page and a plausible size.
 *   BASE=http://localhost:3520 OUT=<dir> [LANGS=en,ur] [PAGES=/dashboard/a,/dashboard/b] node scripts/dev/print-audit-e2e.mjs
 */
import fs from "node:fs"; import path from "node:path"; import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3520"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; if (!OUT) throw new Error("OUT required"); fs.mkdirSync(OUT, { recursive: true });
const LANGS = (process.env.LANGS || "en,ur").split(",");
const SETTLE = Number(process.env.SETTLE || 3500);
const side = fs.readFileSync("components/layout/digital-dock-premium-sidebar.tsx", "utf8");
const all = [...new Set([...side.matchAll(/href: "(\/dashboard\/[a-z0-9\/_-]+)"/g)].map((m) => m[1]))];
const KEEP = /\/(journal|ledger|roznamcha|reports|purchase|sales|accounts|expenses|tax|settlement|inventory|clearing-agent|shipping-line|crm|customer-inquiries|temp-bills|consignment|bill-cost-profit|business-edit-invoice)/;
const PAGES = process.env.PAGES ? process.env.PAGES.split(",") : all.filter((p) => KEEP.test(p));
const results = []; const check = (n, ok, d = "") => { results.push({ n, ok: !!ok }); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 200) : ""); };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch();
for (const lang of LANGS) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
  await ctx.addInitScript(([l]) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, [lang]);
  for (const pth of PAGES) {
    const tag = `${pth} [${lang}]`; const p = await ctx.newPage(); const errs = [];
    p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
    try {
      await p.goto(BASE + pth, { waitUntil: "domcontentloaded", timeout: 120000 });
      await p.waitForFunction(() => !document.querySelector(".animate-spin") && document.body.innerText.length > 120, null, { timeout: 60000 }).catch(() => {});
      await p.waitForTimeout(SETTLE);
      const bad = await p.evaluate(() => /Application error|This page couldn.t load|Internal Server Error|Unhandled Runtime Error/i.test(document.body.innerText));
      await p.emulateMedia({ media: "print" }); await p.waitForTimeout(300);
      const info = await p.evaluate(() => {
        const vis = (e) => { if (!e) return false; const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0; };
        return { aside: vis(document.querySelector("aside")), toggle: vis(document.querySelector("[data-testid='view-mode-toggle']")), overflow: document.documentElement.scrollWidth - window.innerWidth };
      });
      const pdf = await p.pdf({ format: "A4", printBackground: true }).catch(() => null);
      const pages = pdf ? (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length : 0;
      const ok = !bad && !info.aside && !info.toggle && info.overflow <= 2 && pdf && pdf.length > 4000 && pages >= 1 && errs.length === 0;
      check(tag, ok, ok ? `pdf ${pages}p ${(pdf.length / 1024) | 0}KB` : `error-boundary=${bad} aside=${info.aside} toggle=${info.toggle} overflow=${info.overflow} pdf=${pdf ? pdf.length : "none"} pages=${pages} errs=${errs.slice(0, 1).join("|")}`);
      if (pdf && pages) fs.writeFileSync(path.join(OUT, `${lang}-${pth.replace(/\W+/g, "_")}.pdf`), pdf);
    } catch (e) { check(tag, false, "load/pdf failed: " + String(e).slice(0, 120)); }
    await p.close();
  }
  await ctx.close();
}
await b.close();
console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed (${PAGES.length} pages x ${LANGS.length} languages)`);
