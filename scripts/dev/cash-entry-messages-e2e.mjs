/**
 * DEV only — Roznamcha Cash Entry notices follow the selected language and keep their tone (error = red).
 *   BASE=http://localhost:3521 OUT=<dir> node scripts/dev/cash-entry-messages-e2e.mjs
 * Opens New Entry, presses Save Entry on the empty form (nothing is saved — the form refuses), and checks the refusal notice:
 * a central-dictionary sentence in EN / UR / AR / FA / PS, no English sentence in the other four languages, shown in red.
 */
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3521";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".tmp/cash-entry-messages"; fs.mkdirSync(OUT, { recursive: true });
const LANGS = ["en", "ur", "ar", "fa", "ps"];
const KEYS = ["cef.msg_need_country_branch", "cef.msg_need_account", "cef.msg_need_txn_type", "cef.msg_need_payment_mode", "cef.msg_need_amount", "cef.msg_need_currency", "cef.msg_need_all", "cj.mRatePendingBody"];
// the expected sentences, read from the central dictionary itself (one Dict block per language)
const ui = fs.readFileSync("lib/i18n/ui.ts", "utf8");
const expected = {};
for (const l of LANGS) {
  const start = ui.indexOf(`const ${l}: Dict = {`);
  const block = ui.slice(start, ui.indexOf("\n};", start));
  expected[l] = KEYS.map((k) => (block.match(new RegExp(`"${k.replace(/\./g, "\\.")}": "((?:[^"\\\\]|\\\\.)*)"`)) || [])[1]).filter(Boolean)
    .map((v) => JSON.parse(`"${v}"`).split("{")[0].trim()).filter((v) => v.length > 8);
}
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 200) : ""); };
const r0 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r0.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const browser = await chromium.launch();
for (const lang of LANGS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
  await ctx.addInitScript((l) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, lang);
  const p = await ctx.newPage();
  const posts = [];
  p.on("request", (rq) => { if (rq.method() !== "GET" && /\/api\/erp\/roznamcha/.test(rq.url())) posts.push(rq.method() + " " + rq.url()); });
  try {
    await p.goto(BASE + "/dashboard/roznamcha/cash-entry", { waitUntil: "domcontentloaded", timeout: 180000 });
    await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(3000);
    const newEntry = p.locator("#erp-page-actions-slot button, button").filter({ has: p.locator("svg.lucide-plus") }).first();
    await newEntry.click({ timeout: 30000 });
    const post = p.locator("button.dgt-cj-post").first();
    await post.waitFor({ state: "visible", timeout: 30000 });
    await post.click();
    await p.waitForTimeout(1500);
    const notice = await p.evaluate(() => {
      const box = [...document.querySelectorAll("div.rounded-xl.border, div.rounded-lg.border")].find((d) => d.querySelector(":scope > div > span, :scope > span") && /border-rose-200|border-emerald-200/.test(d.className));
      return box ? { text: box.innerText.trim(), red: /border-rose-200/.test(box.className) } : null;
    });
    await p.screenshot({ path: `${OUT}/cash-entry-notice-${lang}.png` });
    check(`${lang}: Save Entry on the empty form shows a notice`, !!notice, "");
    check(`${lang}: the notice is a dictionary sentence in the selected language`, !!notice && expected[lang].some((e) => notice.text.includes(e)), notice?.text);
    if (lang !== "en") check(`${lang}: no English sentence in the notice`, !!notice && !/Please|Cannot post|exchange rate/i.test(notice.text), notice?.text);
    check(`${lang}: the refusal is shown as an error (red)`, !!notice && notice.red, "");
    check(`${lang}: nothing was posted`, posts.length === 0, posts.join(" | "));
  } catch (e) {
    check(`${lang}: screen opens`, false, String(e.message).split("\n")[0]);
  }
  await ctx.close();
}
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n==== ${results.length - failed} PASS / ${failed} FAIL ====`);
process.exit(failed ? 1 : 0);
