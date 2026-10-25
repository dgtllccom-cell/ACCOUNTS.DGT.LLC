/**
 * DEV only — the three Shipping Line dashboards, the Branch Reports suite and the permission-management screen, opened by the
 * persona each one is built for (Branch Admin / Country Admin / Super Admin), in EN / UR / AR / FA / PS at desktop and phone width.
 *   BASE=http://localhost:3521 OUT=<dir> node scripts/dev/shipping-dashboards-i18n-e2e.mjs
 * Checks per page: renders real content (not the "branch permission required" notice), RTL/LTR direction, no sideways scroll,
 * no leftover English labels (headers, buttons, labels, options, titles, placeholders), no page errors.
 */
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3521";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; if (!OUT) throw new Error("OUT required"); fs.mkdirSync(OUT, { recursive: true });
const PK = { country: "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", main: "5269c1cb-92a1-4aa8-aad8-d4c7260badaa", chaman: "ccb85723-e596-4ae8-8bc1-b10f60703197" };

const PERSONAS = {
  branch: { body: { role: "city_branch_admin", countryId: PK.country, countryBranchId: PK.main, cityBranchId: PK.chaman, operationalDomain: "shipping" } },
  country: { body: { role: "country_admin", countryId: PK.country, operationalDomain: "shipping" } },
  super: { body: { role: "super_admin" } },
};
const PAGES = [
  ["branch", "/dashboard/shipping-line/branch"],
  ["branch", "/dashboard/reports/branch-reports"],
  ["branch", "/dashboard/branch-management/permissions"],
  ["country", "/dashboard/country/shipping-line"],
  ["super", "/dashboard/super-admin/shipping-line"],
];
const LANGS = (process.env.LANGS || "en,ur,ar,fa,ps").split(",");
const WIDTHS = (process.env.WIDTHS || "1440,390").split(",").map(Number);
const ALLOWED = /^(PDF|Excel|CSV|ERP|USD|AED|PKR|AFN|EUR|CNY|INR|KG|MT|TEU|FCL|LCL|BL|CBM|DGT|SMS|ID|No|N\/A|OK|GST|VAT|TRN|IBAN|SWIFT|QR|Print|A4|LLC)$/i;

const results = [];
const check = (n, ok, d = "") => { results.push({ n, ok: !!ok }); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 600) : ""); };

const tokens = {};
for (const [k, v] of Object.entries(PERSONAS)) {
  const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v.body) });
  if (!r.ok) throw new Error(`dev-session ${k} failed ${r.status}`);
  tokens[k] = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
}

const b = await chromium.launch();
for (const lang of LANGS) {
  for (const w of WIDTHS) {
    for (const [persona, path] of PAGES) {
      const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
      await ctx.addCookies([{ name: "erp_session", value: tokens[persona], domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
      await ctx.addInitScript(([l]) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, [lang]);
      const p = await ctx.newPage(); const errs = [];
      p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
      const tag = `${persona} ${path} [${lang} ${w}px]`;
      try {
        await p.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 180000 });
        await p.waitForFunction(() => !document.querySelector(".animate-spin") && document.body.innerText.length > 200, null, { timeout: 60000 }).catch(() => {});
        await p.waitForTimeout(3000);
        if (lang !== "en") await p.waitForFunction(() => /[؀-ۿ]/.test((document.querySelector("main") || document.body).innerText), null, { timeout: 12000 }).catch(() => {});
        const info = await p.evaluate(() => {
          const main = document.querySelector("main") || document.body;
          const chrome = [...main.querySelectorAll("th, button, label, option, h1, h2, h3, h4, a[role=button], [role=tab], p, span")].map((e) => (e.children.length === 0 ? (e.innerText || "").trim() : "")).filter(Boolean);
          const attrs = [...main.querySelectorAll("[placeholder], [title], [aria-label]")].flatMap((e) => [e.getAttribute("placeholder"), e.getAttribute("title"), e.getAttribute("aria-label")]).filter(Boolean);
          return { dir: document.documentElement.dir || getComputedStyle(document.body).direction, chrome, attrs, overflow: document.documentElement.scrollWidth - innerWidth, len: main.innerText.length, notice: /permission required|صلاحية|Branch permission/i.test(main.innerText.slice(0, 400)) && main.innerText.length < 400 };
        });
        const rtl = ["ur", "ar", "fa", "ps"].includes(lang);
        check(`${tag}: renders the dashboard (not the permission notice)`, info.len > 300 && !info.notice, `len=${info.len}`);
        check(`${tag}: direction ${rtl ? "RTL" : "LTR"}`, info.dir === (rtl ? "rtl" : "ltr"), info.dir);
        check(`${tag}: no sideways page scroll`, info.overflow <= 2, String(info.overflow));
        if (lang !== "en") {
          const latinOnly = (s) => /[A-Za-z]{3,}/.test(s) && !/[؀-ۿݐ-ݿ]/.test(s);
          const isData = (s) => /\d/.test(s) || /@/.test(s) || /^[A-Z0-9 ._\/-]{2,}$/.test(s) && s.split(/\s+/).every((t) => ALLOWED.test(t) || /\d/.test(t));
          const tokensOf = (s) => s.split(/[\s/&,()·:-]+/).filter(Boolean);
          const left = [...new Set([...info.chrome, ...info.attrs].map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length <= 80 && latinOnly(s) && !isData(s) && !tokensOf(s).every((t) => ALLOWED.test(t))))];
          // proper names of branches / users / ports in the DEV data are data, not chrome
          const real = left.filter((s) => !/\b(Branch|Shipping & Clearing Branch|City Branch|Main Branch)$/.test(s) || /Reports|Dashboard|Operations/.test(s));
          check(`${tag}: no leftover English labels`, real.length === 0, `(${real.length}) ` + real.slice(0, 12).join(" | "));
        }
        check(`${tag}: no page errors`, errs.length === 0, errs.slice(0, 2).join(" | "));
        if (w === 1440) await p.screenshot({ path: `${OUT}/${lang}-${persona}-${path.split("/").slice(-1)[0]}.png` }).catch(() => {});
      } catch (e) { check(`${tag}: loaded`, false, String(e).slice(0, 160)); }
      await ctx.close();
    }
  }
}
await b.close();
const bad = results.filter((x) => !x.ok);
console.log(`\n==== ${results.length - bad.length} PASS / ${bad.length} FAIL ====`);
process.exit(bad.length ? 1 : 0);
