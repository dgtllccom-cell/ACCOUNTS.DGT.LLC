/**
 * DEV only — Customer Order screens in EN / UR / AR / FA / PS (+ RTL, no leftover English chrome, no page errors, no sideways scroll).
 *   BASE=http://localhost:3520 OUT=<dir> ORDER_ID=<uuid> node scripts/dev/customer-order-i18n-e2e.mjs
 * Screens: customer bill register, order detail / transfer hub (?id=), the customer-order management list.
 * "Leftover English" = visible chrome (th, button, label, option, h1-h4, placeholder, title) made only of Latin words that are not data or a known code.
 */
import fs from "node:fs"; import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3520"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; if (!OUT) throw new Error("OUT required"); fs.mkdirSync(OUT, { recursive: true });
const ORDER_ID = process.env.ORDER_ID || "";
const LANGS = (process.env.LANGS || "en,ur,ar,fa,ps").split(",");
const WIDTHS = (process.env.WIDTHS || "1440,820,390").split(",").map(Number);
const SCREENS = process.env.SCREENS ? process.env.SCREENS.split(",").map((x) => x.split(/=(.+)/).slice(0, 2)) : [
  ["register", "/dashboard/clearing-agent/customer-bill"],
  ...(ORDER_ID ? [["detail-hub", `/dashboard/clearing-agent/customer-bill?id=${ORDER_ID}`]] : []),
  ["management", "/dashboard/clearing-agent/customer-order"],
];
const results = []; const check = (n, ok, d = "") => { results.push({ n, ok: !!ok }); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 900) : ""); };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch();
// words that are allowed to stay Latin in any language: standards, units, currencies, document codes
const ALLOWED = /^(PDF|Excel|CSV|ERP|USD|AED|PKR|AFN|EUR|CNY|INR|KG|MT|TEU|FCL|LCL|BL|CBM|DGT|SMS|ID|No|N\/A|OK|GST|VAT|TRN|IBAN|SWIFT|QR|Print|A4)$/i;
for (const lang of LANGS) {
  for (const w of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
    await ctx.addInitScript(([l]) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, [lang]);
    for (const [name, path] of SCREENS) {
      const p = await ctx.newPage(); const errs = [];
      p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
      const tag = `${name} [${lang} ${w}px]`;
      if (path.includes("?id=undefined") || path.endsWith("?id=")) { await p.close(); continue; }
      try {
        await p.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 180000 });
        await p.waitForFunction(() => !document.querySelector(".animate-spin") && document.body.innerText.length > 200, null, { timeout: 90000 }).catch(() => {});
        await p.waitForTimeout(Number(process.env.SETTLE || 2500));
        const info = await p.evaluate(() => {
          const dir = document.documentElement.dir || document.body.dir || getComputedStyle(document.body).direction;
          const main = document.querySelector("main") || document.body;
          const chrome = [...main.querySelectorAll("th, button, label, option, h1, h2, h3, h4, a[role=button], [role=tab]")].map((e) => (e.innerText || "").trim()).filter(Boolean);
          const attrs = [...main.querySelectorAll("[placeholder], [title], [aria-label]")].flatMap((e) => [e.getAttribute("placeholder"), e.getAttribute("title"), e.getAttribute("aria-label")]).filter(Boolean);
          return { dir, chrome, attrs, overflow: document.documentElement.scrollWidth - innerWidth, hasTable: !!main.querySelector("table"), len: document.body.innerText.length };
        });
        const rtl = ["ur", "ar", "fa", "ps"].includes(lang);
        check(`${tag}: page renders`, info.len > 300, `len=${info.len}`);
        check(`${tag}: direction ${rtl ? "RTL" : "LTR"}`, info.dir === (rtl ? "rtl" : "ltr"), info.dir);
        check(`${tag}: no sideways page scroll`, info.overflow <= 2, String(info.overflow));
        if (lang !== "en") {
          const latinOnly = (s) => /[A-Za-z]{3,}/.test(s) && !/[؀-ۿݐ-ݿ]/.test(s);
          const isData = (s) => /\d/.test(s) || /^[A-Z0-9 ._\/-]{2,}$/.test(s) && s.split(/\s+/).every((t) => ALLOWED.test(t) || /\d/.test(t));
          const left = [...new Set([...info.chrome, ...info.attrs].map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length <= 60 && latinOnly(s) && !isData(s) && !s.split(/[\s/&,-]+/).filter(Boolean).every((t) => ALLOWED.test(t))))];
          check(`${tag}: no leftover English labels`, left.length === 0, `(${left.length}) ` + left.slice(0, process.env.SHOW ? 80 : 8).join(" | "));
        }
        check(`${tag}: no page errors`, errs.length === 0, errs.slice(0, 2).join(" | "));
        if (w === 1440) await p.screenshot({ path: `${OUT}/${lang}-${name}.png` }).catch(() => {});
      } catch (e) { check(`${tag}: loaded`, false, String(e).slice(0, 120)); }
      await p.close();
    }
    await ctx.close();
  }
}
await b.close(); console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed`);
