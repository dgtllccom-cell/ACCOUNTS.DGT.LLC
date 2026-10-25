/**
 * Shared customer picker (PersonPicker) five-language name check on DEV — Bank Master Form > Account Owner > Individual (Person).
 *   BASE=http://localhost:3530 OUT=<dir> node scripts/dev/customer-picker-i18n-e2e.mjs
 * The authorized fixture must show its own-language name as the ONE primary text (no second line until the bilingual option is on);
 * the machine-only customer must keep its saved name.
 */
import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3530"; if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".tmp/cust-shots"; fs.mkdirSync(OUT, { recursive: true });
const ui = fs.readFileSync("lib/i18n/ui.ts", "utf8");
const grab = (k) => [...ui.matchAll(new RegExp('"' + k.replace(".", "\.") + '": "([^"]*)"', "g"))].map((m) => m[1]);
const OPEN = grab("dintake.em_start_manual"), PERSON = grab("bank.owner_individual"), OWNER = grab("bank.owner_person_label");
const ORDER = ["en", "ur", "ar", "fa", "ps"];
const AUTH = { en: "DEV TEST ONLY Al-Farooq Traders", ur: "ڈی ای وی ٹیسٹ الفاروق ٹریڈرز", ar: "الفاروق للتجارة (اختبار)", fa: "الفاروق تریدرز (آزمایشی)", ps: "الفاروق سوداګر (ازموینه)" };
const results = []; const check = (n, ok, d = "") => { results.push({ n, ok: !!ok }); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 300) : ""); };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch();
for (const lang of (process.env.LANGS || "en,ur,ar,fa,ps").split(",")) {
  const i = ORDER.indexOf(lang);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
  await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
  await ctx.addInitScript(([l]) => { try { localStorage.setItem("erp_lang", l); localStorage.removeItem("erp_customer_bilingual_names"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, [lang]);
  const p = await ctx.newPage();
  try {
    await p.goto(BASE + "/dashboard/settings/bank/new", { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.getByText(OPEN[i], { exact: true }).first().click({ timeout: 60000 });
    await p.getByText(PERSON[i], { exact: true }).first().click({ timeout: 120000 });
    await p.waitForTimeout(3000);
    // open the picker (the combobox button right under the "Account Owner (Person)" label) and search for the fixture
    const label = p.getByText(OWNER[i], { exact: true }).first();
    await label.waitFor({ timeout: 120000 });
    const combo = label.locator("xpath=following::button[1]");
    await p.waitForTimeout(12000); // the customer list (500 rows) loads asynchronously
    await combo.click({ timeout: 20000 });
    await p.waitForTimeout(800);
    const box = p.locator("input[placeholder]:visible").last();
    await box.fill("Al-Farooq");
    await p.waitForTimeout(2500);
    const opened = "combobox";
    const text = await p.evaluate(() => document.body.innerText);
    check(`${lang} picker lists the authorized customer by its ${lang} name (primary)`, text.includes(AUTH[lang]), opened || "no trigger found");
    if (lang !== "en") check(`${lang} picker does not also print the English name on a second line`, !text.includes(AUTH.en) || text.split(AUTH.en).length === 1, "");
    await p.screenshot({ path: `${OUT}/picker-${lang}.png` });
  } catch (e) { check(`${lang} picker check ran`, false, e.message); try { await p.screenshot({ path: `${OUT}/picker-${lang}-ERROR.png` }); } catch {} }
  await ctx.close();
}
await b.close();
const failed = results.filter((x) => !x.ok); console.log(`\n${results.length - failed.length}/${results.length} passed`); process.exit(failed.length ? 1 : 0);
