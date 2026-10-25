/**
 * Customer Register five-language name display check (DEV ONLY — localhost).
 *   BASE=http://localhost:3530 OUT=<dir> node scripts/dev/customer-register-i18n-e2e.mjs
 *
 * Verifies, per language (en/ur/ar/fa/ps) x width (desktop/tablet/mobile):
 *  - the DEV-test customer with an AUTHORIZED translation shows its own version of the name as the single primary name
 *  - a customer whose stored translations are machine-only keeps its saved (legal) name in every language
 *  - no name cell shows a second language line while the bilingual option is off
 *  - RTL on <html> and the table for ur/ar/fa/ps (LTR for en); no page-level horizontal overflow
 *  - table headers / toolbar are not left in English for the non-English languages
 *  - the bilingual option shows the second line, and turning it off removes it again
 */
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3530";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".tmp/cust-shots";
fs.mkdirSync(OUT, { recursive: true });

const LANGS = (process.env.LANGS || "en,ur,ar,fa,ps").split(",");
const WIDTHS = { desktop: 1440, tablet: 768, mobile: 390 };
const AUTH_ID = "092d8917-3b96-48d2-bdcf-e316ebcb2ab7";
const AUTH_NAMES = {
  en: "DEV TEST ONLY Al-Farooq Traders",
  ur: "ڈی ای وی ٹیسٹ الفاروق ٹریڈرز",
  ar: "الفاروق للتجارة (اختبار)",
  fa: "الفاروق تریدرز (آزمایشی)",
  ps: "الفاروق سوداګر (ازموینه)"
};

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok });
  console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 400) : "");
};

const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);

// A customer saved in Arabic script whose translations are machine-only (not authorized) — must keep the saved name everywhere.
const listRes = await fetch(BASE + "/api/erp/customers?limit=500&lang=en", { headers: { cookie: `erp_session=${token}` } });
const listJson = await listRes.json();
const customers = listJson?.data?.customers ?? listJson?.customers ?? [];
const machineOnly = customers.find((c) => /[؀-ۿ]/.test(c.customer_name) && c.name_translation_authorized === false);
const authRow = customers.find((c) => c.id === AUTH_ID);
check("API exposes name_translation_authorized (authorized fixture = true)", authRow?.name_translation_authorized === true, JSON.stringify({ found: !!authRow, flag: authRow?.name_translation_authorized }));
check("API: machine-only Arabic-script customer found and NOT authorized", !!machineOnly, machineOnly?.customer_name);

const b = await chromium.launch();
const ENGLISH_HEADER = /^(Customer Name|Customer ID|Company|Status|Actions?|Country|Branch|Phone|Email|Name|Type)$/i;

for (const lang of LANGS) {
  for (const [wName, w] of Object.entries(WIDTHS)) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    await ctx.addCookies([
      { name: "erp_session", value: token, domain: "localhost", path: "/" },
      { name: "erp_lang", value: lang, domain: "localhost", path: "/" }
    ]);
    await ctx.addInitScript(([l]) => { try { localStorage.setItem("erp_lang", l); localStorage.removeItem("erp_customer_bilingual_names"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, [lang]);
    const p = await ctx.newPage();
    const tag = `${lang}/${wName}`;
    try {
      await p.goto(BASE + "/dashboard/settings/customers", { waitUntil: "domcontentloaded", timeout: 180000 });
      await p.waitForFunction(() => document.querySelectorAll("table tbody tr").length > 3, null, { timeout: 120000 });
      await p.waitForTimeout(1500);
      // widen the page size so the fixtures are on the first page
      const data = await p.evaluate(({ authName, machineName }) => {
        const rows = [...document.querySelectorAll("table tbody tr")];
        const cells = rows.map((tr) => tr.querySelectorAll("td")[3]).filter(Boolean);
        const text = (el) => (el?.innerText || "").trim();
        const lines = (el) => [...el.querySelectorAll("span.font-bold, div[dir='auto']")].map((n) => n.textContent.trim()).filter(Boolean);
        return {
          rowCount: rows.length,
          htmlDir: document.documentElement.dir,
          tableDir: document.querySelector("table")?.getAttribute("dir"),
          overflowX: document.documentElement.scrollWidth - window.innerWidth,
          secondLines: cells.filter((c) => c.querySelector("div[dir='auto']")).length,
          names: cells.map(text),
          headers: [...document.querySelectorAll("table thead th")].map((th) => th.innerText.trim()).filter(Boolean),
          authCell: cells.map(text).find((t) => t.includes(authName)) ?? null,
          machineCell: machineName ? cells.map(text).find((t) => t.includes(machineName)) ?? null : null
        };
      }, { authName: AUTH_NAMES[lang], machineName: machineOnly?.customer_name ?? "" });

      check(`${tag} rows rendered`, data.rowCount > 0, data.rowCount);
      check(`${tag} direction`, lang === "en" ? data.htmlDir !== "rtl" && data.tableDir === "ltr" : data.htmlDir === "rtl" && data.tableDir === "rtl", `${data.htmlDir}/${data.tableDir}`);
      check(`${tag} no page-level horizontal overflow`, data.overflowX <= 2, data.overflowX);
      check(`${tag} no second name line while the bilingual option is off`, data.secondLines === 0, data.secondLines);
      const leak = await p.evaluate(() => {
        const text = document.body.innerText;
        const raw = ["CREATEDDATELABEL", "createdDateLabel", "customerList", "customersTitle"].filter((k) => text.includes(k));
        const lonelyHome = [...document.querySelectorAll("span")].some((e) => e.children.length === 0 && e.textContent.trim() === "home");
        const dateCells = [...document.querySelectorAll("table tbody tr td")].map((td) => td.innerText.trim()).filter((t) => /^[0-9]{2} [^ ]+ [0-9]{4}$/.test(t));
        return { raw, lonelyHome, dateCells: dateCells.slice(0, 5) };
      });
      check(`${tag} no raw translation keys on screen`, leak.raw.length === 0 && !leak.lonelyHome, JSON.stringify(leak));
      if (lang !== "en") check(`${tag} created-date cells use localized month names`, leak.dateCells.length > 0 && leak.dateCells.every((d) => !/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(d)), leak.dateCells.join(" | "));
      if (lang !== "en") {
        const english = data.headers.filter((h) => ENGLISH_HEADER.test(h));
        check(`${tag} table headers translated`, english.length === 0, english.join("|"));
      }
      const trigger = p.locator("button.h-9.rounded-xl:has(svg.lucide-search)").first();
      const readNames = () => p.evaluate(() => [...document.querySelectorAll("table tbody tr")].map((tr) => (tr.querySelectorAll("td")[3]?.innerText || "").replace(/[\t\n\r ]+/g, " ").trim()));
      const search = async (q) => {
        if (!(await p.locator("div.space-y-3 input[type=text]").first().isVisible().catch(() => false))) await trigger.click();
        const input = p.locator("div.space-y-3 input[type=text]").first();
        await input.waitFor({ timeout: 15000 });
        await input.fill(q);
        await p.waitForTimeout(600);
        return readNames();
      };
      const authRows = await search("DEV TEST ONLY Al-Farooq");
      const pop = await p.evaluate(() => { const i = document.querySelector("div.space-y-3 input[type=text]"); const el = i && i.closest("div.shadow-2xl"); if (!el) return null; const r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), vw: window.innerWidth }; });
      check(`${tag} filters popover fits inside the screen`, !!pop && pop.left >= -1 && pop.right <= pop.vw + 1, JSON.stringify(pop));
      const authShown = JSON.stringify(authRows);
      check(`${tag} authorized customer shows its ${lang} version as the single primary name`, authRows.length === 1 && authRows[0].includes(AUTH_NAMES[lang]) && (lang === "en" || !authRows[0].includes(AUTH_NAMES.en)), authShown);
      if (machineOnly) {
        const mRows = await search(machineOnly.customer_name);
        check(`${tag} machine-only customer keeps the saved legal name`, mRows.length >= 1 && mRows[0].includes(machineOnly.customer_name), mRows[0] || "missing");
      }
      // Bilingual option (desktop only): on -> second line appears, off -> gone again
      await search("DEV TEST ONLY Al-Farooq");
      await p.screenshot({ path: `${OUT}/${lang}-${wName}.png`, fullPage: false });
      if (wName === "desktop") {
        const box = p.locator("div.space-y-3 label:has(input[type=checkbox])").first();
        await box.locator("input").check();
        await p.waitForTimeout(500);
        const on = await p.evaluate(() => document.querySelectorAll("table tbody tr td:nth-child(4) div[dir='auto']").length);
        await p.screenshot({ path: `${OUT}/${lang}-${wName}-both-names.png`, fullPage: false });
        await box.locator("input").uncheck();
        await p.waitForTimeout(500);
        const off = await p.evaluate(() => document.querySelectorAll("table tbody tr td:nth-child(4) div[dir='auto']").length);
        check(`${tag} bilingual option: second line appears when on (${on}) and disappears when off (${off})`, (lang === "en" ? on >= 0 : on > 0) && off === 0);
        const labelText = await box.innerText();
        // Customer Details (Party 360): header shows the same language-aware name; no hard-coded Urdu/English account labels
        await p.keyboard.press("Escape");
        await search("DEV TEST ONLY Al-Farooq");
        await p.locator("table tbody tr td:last-child button").first().click();
        await p.locator("button:has(svg.lucide-layers)").last().click();
        await p.waitForSelector("h2", { timeout: 30000 });
        await p.waitForTimeout(2500);
        const modalInfo = await p.evaluate(() => { const h = [...document.querySelectorAll("h2")].find((e) => e.closest(".fixed")); return { title: h?.innerText || "", body: (h?.closest(".fixed")?.innerText || "").slice(0, 4000) }; });
        check(`${tag} customer details header shows the single language-aware name`, modalInfo.title.includes(AUTH_NAMES[lang]) && (lang === "en" || !modalInfo.title.includes(AUTH_NAMES.en)), modalInfo.title);
        await p.screenshot({ path: `${OUT}/${lang}-${wName}-details.png`, fullPage: false });
        await p.keyboard.press("Escape");
        if (lang !== "en") check(`${tag} bilingual option label is translated`, !/Show both names/i.test(labelText), labelText.replace(/[\t\n\r ]+/g, " "));
      }
    } catch (e) {
      check(`${tag} page check ran`, false, e.message);
      try { await p.screenshot({ path: `${OUT}/${lang}-${wName}-ERROR.png` }); } catch {}
    }
    await ctx.close();
  }
}
await b.close();
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed, ${failed.length} failed`);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
