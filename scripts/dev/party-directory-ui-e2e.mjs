/**
 * DEV only — Party Directory screen (Customer Register → Party Directory) with REAL DEV records, EN / UR / AR / FA / PS:
 *   BASE=http://localhost:3521 OUT=<dir> node scripts/dev/party-directory-ui-e2e.mjs
 * - searching by the name exactly as it was saved finds the party in every language;
 * - the row shows the approved variant for the selected language, otherwise the saved name — never a stored machine rendering;
 * - a live language switch reloads the names (they were kept in the language the screen was opened in).
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { devQuery } from "./_rbac-users.mjs";

const BASE = process.env.BASE || "http://localhost:3521";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".tmp/party-directory-ui"; fs.mkdirSync(OUT, { recursive: true });
const LANGS = ["en", "ur", "ar", "fa", "ps"];
const COL = { ur: "urdu_text", ar: "arabic_text", fa: "persian_text", ps: "pashto_text", en: "english_text" };
// one customer with approved variants, one whose stored renderings are machine-made (must never be shown)
const CUSTOMERS = ["092d8917-3b96-48d2-bdcf-e316ebcb2ab7", "e967e161-6930-4d66-a4c5-8624bbded024"];
const ui = fs.readFileSync("lib/i18n/ui.ts", "utf8");
const dictValue = (lang, key) => { const s = ui.indexOf(`const ${lang}: Dict = {`); const blk = ui.slice(s, ui.indexOf("\n};", s)); const m = blk.match(new RegExp(`"${key.replace(/\./g, "\\.")}": "((?:[^"\\\\]|\\\\.)*)"`)); return m ? JSON.parse(`"${m[1]}"`) : null; };

const records = [];
for (const id of CUSTOMERS) {
  const c = (await devQuery((sql) => sql`select customer_name from public.customers where id = ${id}::uuid`))[0];
  const t = (await devQuery((sql) => sql`select english_text, urdu_text, arabic_text, persian_text, pashto_text, source::text as source, translation_status, corrected_by from public.record_translations where record_table = 'customers' and record_id = ${id}::uuid and field_name = 'customer_name' and deleted_at is null limit 1`))[0];
  const approved = !!t && (t.source === "manual" || !!t.corrected_by || ["human_verified", "verified", "approved"].includes(String(t.translation_status)));
  const expected = {}; const machine = new Set();
  for (const l of LANGS) { const v = t?.[COL[l]]; expected[l] = approved && v ? v : c.customer_name; if (!approved && v && v !== c.customer_name) machine.add(v); }
  records.push({ id, saved: c.customer_name, approved, expected, machine: [...machine] });
}

const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 220) : ""); };
const r0 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r0.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const browser = await chromium.launch();

async function openDirectory(lang) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
  await ctx.addInitScript((l) => { try { if (!sessionStorage.getItem("e2e_lang_set")) { localStorage.setItem("erp_lang", l); sessionStorage.setItem("e2e_lang_set", "1"); } localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, lang);
  const p = await ctx.newPage();
  await p.goto(BASE + "/dashboard/customers?view=journal", { waitUntil: "domcontentloaded", timeout: 180000 });
  await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  return { ctx, p };
}
const searchBox = (p, lang) => p.locator(`input[placeholder="${dictValue(lang, "upd.search_ph")}"]`).first();
async function searchAndRead(p, lang, q) {
  const box = searchBox(p, lang);
  await box.waitFor({ timeout: 60000 });
  await box.fill(q);
  await p.waitForTimeout(1200);
  // only the directory's own table (the Customer Register table stays behind it)
  return p.evaluate((ph) => {
    let el = document.querySelector(`input[placeholder="${ph}"]`);
    while (el && !el.querySelector?.("table")) el = el.parentElement;
    return el ? [...el.querySelectorAll("table tbody tr")].map((tr) => tr.innerText.replace(/\s+/g, " ").trim()).join("\n") : "";
  }, dictValue(lang, "upd.search_ph"));
}

for (const lang of LANGS) {
  const { ctx, p } = await openDirectory(lang);
  try {
    for (const rec of records) {
      const tag = `[${lang} · "${rec.saved}"${rec.approved ? " · approved variants" : ""}]`;
      let rows = "";
      for (let i = 0; i < 5; i++) { rows = await searchAndRead(p, lang, rec.saved); if (rows.includes(rec.expected[lang])) break; await p.waitForTimeout(3000); }
      check(`${tag} search by the saved name finds the party`, rows.includes(rec.expected[lang]), rows.split("\n")[0]);
      check(`${tag} the row shows "${rec.expected[lang]}"`, rows.includes(rec.expected[lang]), "");
      check(`${tag} no machine rendering of the name`, rec.machine.every((m) => !rows.includes(m)), rec.machine.filter((m) => rows.includes(m)).join(" | "));
    }
    await p.screenshot({ path: `${OUT}/party-directory-${lang}.png` });
  } catch (e) {
    check(`[${lang}] Party Directory opens`, false, String(e.message).split("\n")[0]);
  }
  await ctx.close();
}

// live language switch: opened in UR, switched to AR (the way the language control does it) — the names follow
{
  const rec = records.find((r) => r.approved);
  const { ctx, p } = await openDirectory("ur");
  try {
    const before = await searchAndRead(p, "ur", rec.saved);
    check(`[live switch] opened in ur: "${rec.expected.ur}"`, before.includes(rec.expected.ur), before.split("\n")[0]);
    await p.evaluate((l) => { localStorage.setItem("erp_lang", l); document.cookie = `erp_lang=${l}; path=/`; window.dispatchEvent(new Event("erp_language_changed")); }, "ar");
    let after = "";
    for (let i = 0; i < 10; i++) { await p.waitForTimeout(3000); after = await searchAndRead(p, "ar", rec.saved).catch(() => ""); if (after.includes(rec.expected.ar)) break; }
    check(`[live switch] after switching to ar: "${rec.expected.ar}"`, after.includes(rec.expected.ar), after.split("\n")[0]);
    check(`[live switch] the Urdu variant is gone`, !after.includes(rec.expected.ur), "");
  } catch (e) {
    check(`[live switch] runs`, false, String(e.message).split("\n")[0]);
  }
  await ctx.close();
}
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n==== ${results.length - failed} PASS / ${failed} FAIL ====`);
process.exit(failed ? 1 : 0);
