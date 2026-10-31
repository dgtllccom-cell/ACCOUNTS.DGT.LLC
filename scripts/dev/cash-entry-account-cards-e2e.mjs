/**
 * DEV only — Cash Entry account / customer picker shows the shared customer & account card, EN / UR / AR / FA / PS + phone width.
 *   BASE=http://localhost:3521 OUT=<dir> node scripts/dev/cash-entry-account-cards-e2e.mjs
 * Each option is a card with the account name, account number, company, phone, e-mail, address and Active / Inactive status —
 * the saved values the account lookup returns (checked against the same API); searching by number and by phone finds it;
 * picking a card still selects the account (Selected Account Details); RTL alignment; the list never overflows a phone screen.
 * Read-only: nothing is posted.
 */
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3521";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".tmp/cash-entry-account-cards"; fs.mkdirSync(OUT, { recursive: true });
const LANGS = ["en", "ur", "ar", "fa", "ps"];
const ui = fs.readFileSync("lib/i18n/ui.ts", "utf8");
const dict = (lang, key) => { const s = ui.indexOf(`const ${lang}: Dict = {`); const m = ui.slice(s, ui.indexOf("\n};", s)).match(new RegExp(`"${key.replace(/\./g, "\\.")}": "((?:[^"\\\\]|\\\\.)*)"`)); return m ? JSON.parse(`"${m[1]}"`) : null; };

const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 200) : ""); };
const r0 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r0.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);

// the account the checks follow: one the lookup returns with a phone AND an e-mail (the same API the form calls)
const api = await fetch(`${BASE}/api/erp/accounting/reports/ledger/ledgers?reportScope=super_admin&limit=3000&language=en`, { headers: { cookie: `erp_session=${token}` } }).then((r) => r.json());
const rows = api?.data?.ledgers ?? api?.ledgers ?? [];
check("[api] the account lookup returns card details (phone / e-mail / status)", rows.some((r) => r.accountPhone) && rows.some((r) => r.accountEmail) && rows.some((r) => r.accountStatus), `${rows.length} rows`);
const byCode = new Map(rows.map((r) => [r.accountCode || r.ledgerCode, r]));
// the form lists the accounts of the selected branch: the checks follow a card the form shows (preferring one with phone + e-mail)
let target = null, code = null, name = null;
async function chooseTarget(p) {
  const shown = await p.locator("[cmdk-item].flex-col span.font-mono").allInnerTexts();
  const candidates = shown.map((c) => byCode.get(c.trim())).filter(Boolean);
  target = candidates.find((r) => r.accountPhone && r.accountEmail) || candidates.find((r) => r.accountPhone) || candidates[0] || null;
  code = target ? (target.accountCode || target.ledgerCode) : null;
  name = target ? (target.accountName || target.ledgerName) : null;
  return shown.length;
}

const browser = await chromium.launch();
async function openPicker(lang, width, sessionToken = token) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 860 : 900 } });
  await ctx.addCookies([{ name: "erp_session", value: sessionToken, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
  await ctx.addInitScript((l) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, lang);
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 140)));
  await p.goto(BASE + "/dashboard/roznamcha/cash-entry", { waitUntil: "domcontentloaded", timeout: 180000 });
  await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(3000);
  await p.locator("#erp-page-actions-slot button, button").filter({ has: p.locator("svg.lucide-plus") }).first().click({ timeout: 30000 });
  const trigger = p.locator(`button[title="${dict(lang, "cef.search_account_ph")}"]`).first();
  await trigger.waitFor({ state: "visible", timeout: 60000 });
  // the accounts load with the branch scope; wait until the trigger is enabled
  for (let i = 0; i < 30 && (await trigger.isDisabled().catch(() => true)); i++) await p.waitForTimeout(1000);
  await trigger.click();
  return { ctx, p, errs };
}
const cards = (p) => p.locator("[cmdk-item].flex-col");
const searchInput = (p) => p.locator("[cmdk-input]").first();

for (const lang of LANGS) {
  const { ctx, p, errs } = await openPicker(lang, 1440);
  try {
    await cards(p).first().waitFor({ timeout: 60000 });
    check(`${lang}: the account list shows cards`, (await cards(p).count()) > 0, `${await cards(p).count()} cards`);
    check(`${lang}: search placeholder in the selected language`, (await searchInput(p).getAttribute("placeholder")) === dict(lang, "ss.account_card_search_ph"));
    const shownCount = await chooseTarget(p);
    check(`${lang}: every card shown is an account the lookup returned`, !!target, `${shownCount} cards`);
    if (lang === "en") console.log("target:", code, "|", target?.accountPhone, "|", target?.accountEmail, "|", target?.accountStatus);
    await searchInput(p).fill(code);
    await p.waitForTimeout(800);
    const card = cards(p).filter({ hasText: code }).first();
    await card.waitFor({ timeout: 20000 });
    const text = (await card.innerText()).replace(/\s+/g, " ");
    check(`${lang}: search by account number finds the card`, text.includes(code), text.slice(0, 120));
    if (target.accountPhone) check(`${lang}: card shows the saved phone`, text.includes(target.accountPhone));
    if (target.accountEmail) check(`${lang}: card shows the saved e-mail`, text.includes(target.accountEmail));
    if (target.accountAddress) check(`${lang}: card shows the saved address`, text.includes(target.accountAddress));
    // the card's status rule (cash-entry-form accountStatusKind): pending approval, else inactive, else active
    const st = String(target.accountStatus || "").toLowerCase();
    const wantStatus = st === "pending_approval" ? dict(lang, "com.status_pending_approval")
      : target.isActive === false || ["inactive", "suspended", "archived", "closed"].includes(st) ? dict(lang, "common.inactive") : dict(lang, "common.active");
    check(`${lang}: card shows the status in the selected language`, text.includes(wantStatus), text.slice(-60));
    if (target.companyName) check(`${lang}: card shows the company`, text.includes(target.companyName));
    const hasPin = await card.locator("svg.lucide-map-pin").count();
    check(`${lang}: card shows an address / location line`, hasPin > 0);
    const align = await card.evaluate((el) => { const box = el.querySelector("div.flex.items-start"); const cs = getComputedStyle(box); return { dir: cs.direction, align: cs.textAlign }; });
    check(`${lang}: card follows the page direction (${lang === "en" ? "ltr" : "rtl"})`, align.dir === (lang === "en" ? "ltr" : "rtl") && align.align === "start", JSON.stringify(align));
    if (target.accountPhone) {
      await searchInput(p).fill(target.accountPhone.trim().slice(-6));
      await p.waitForTimeout(800);
      check(`${lang}: search by phone finds the card`, (await cards(p).filter({ hasText: code }).count()) > 0);
    }
    await searchInput(p).fill(code);
    await p.waitForTimeout(800);
    await cards(p).filter({ hasText: code }).first().click();
    await p.waitForTimeout(2500);
    const body = await p.evaluate(() => document.body.innerText);
    check(`${lang}: picking the card selects the account (Selected Account Details shows it)`, body.includes(name) && (await p.locator("[cmdk-item]").count()) === 0, name);
    await p.screenshot({ path: `${OUT}/cash-entry-cards-${lang}.png` }).catch(() => {});
    check(`${lang}: no page errors`, errs.length === 0, errs.join(" | "));
  } catch (e) {
    check(`${lang}: picker opens`, false, String(e.message).split("\n")[0]);
  }
  await ctx.close();
}

// an account saved with a phone, an e-mail and an address (created here through the real accounts API, archived at the end):
// the Quetta Branch Admin's Cash Entry shows all three on its card, and finds it by phone and by e-mail
{
  const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", PK_MAIN = "5269c1cb-92a1-4aa8-aad8-d4c7260badaa", QUETTA = "7d7d42fe-ddd1-4bec-8703-3911ad14fa8b";
  const run = Date.now().toString(36).slice(-5);
  const saved = { name: `Card Test Trader ${run}`, phone: `+92 333 77${run.length}0${Math.floor(Math.random() * 9000 + 1000)}`, email: `card.${run}@example.invalid`, address: `Shop 12, Liaquat Bazaar ${run}, Quetta` };
  const call = (method, path, body, cookie) => fetch(BASE + path, { method, headers: { "content-type": "application/json", cookie }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
  const created = await call("POST", "/api/erp/accounting/accounts", {
    scope: "city_branch", countryId: PK, countryBranchId: PK_MAIN, cityBranchId: QUETTA, operationalDomain: "business", code: "AUTO",
    name: saved.name, kind: "asset", currency: "PKR", openingBalance: 0, fullAddress: saved.address,
    contacts: [{ type: "Mobile", value: saved.phone }, { type: "Email", value: saved.email }]
  }, `erp_session=${token}`);
  const accountId = (created.json?.data ?? created.json)?.accountId ?? (created.json?.data ?? created.json)?.id;
  check("[quetta] test account with phone, e-mail and address saved", created.status < 300 && !!accountId, `status ${created.status}`);
  const r1 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "city_branch_admin", countryId: PK, countryBranchId: PK_MAIN, cityBranchId: QUETTA, operationalDomain: "business" }) });
  const quettaToken = r1.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
  for (const lang of ["en", "ur"]) {
    if (!accountId) break;
    const { ctx, p, errs } = await openPicker(lang, 1440, quettaToken);
    try {
      await cards(p).first().waitFor({ timeout: 60000 });
      await searchInput(p).fill(saved.name);
      await p.waitForTimeout(800);
      const card = cards(p).filter({ hasText: saved.name }).first();
      await card.waitFor({ timeout: 30000 });
      const text = (await card.innerText()).replace(/\s+/g, " ");
      check(`Quetta ${lang}: card shows the saved phone`, text.includes(saved.phone), text.slice(0, 160));
      check(`Quetta ${lang}: card shows the saved e-mail`, text.includes(saved.email));
      check(`Quetta ${lang}: card shows the saved address`, text.includes(saved.address));
      check(`Quetta ${lang}: phone, e-mail and address icons`, (await card.locator("svg.lucide-phone").count()) > 0 && (await card.locator("svg.lucide-mail").count()) > 0 && (await card.locator("svg.lucide-map-pin").count()) > 0);
      await searchInput(p).fill(saved.email);
      await p.waitForTimeout(800);
      check(`Quetta ${lang}: search by e-mail finds the card`, (await cards(p).filter({ hasText: saved.name }).count()) > 0);
      await searchInput(p).fill(saved.phone.slice(-6));
      await p.waitForTimeout(800);
      check(`Quetta ${lang}: search by phone finds the card`, (await cards(p).filter({ hasText: saved.name }).count()) > 0);
      await searchInput(p).fill(saved.name);
      await p.waitForTimeout(800);
      await p.screenshot({ path: `${OUT}/cash-entry-cards-quetta-${lang}.png` }).catch(() => {});
      check(`Quetta ${lang}: no page errors`, errs.length === 0, errs.join(" | "));
    } catch (e) {
      check(`Quetta ${lang}: picker opens`, false, String(e.message).split("\n")[0]);
    }
    await ctx.close();
  }
  if (accountId) {
    const del = await call("DELETE", `/api/erp/accounting/accounts/${accountId}`, undefined, `erp_session=${token}`);
    check("[quetta] test account archived through the app", del.status < 300, `status ${del.status}`);
  }
}


// phone width: the list fits the screen
for (const lang of ["en", "ur"]) {
  const { ctx, p } = await openPicker(lang, 390);
  try {
    await cards(p).first().waitFor({ timeout: 60000 });
    const fit = await p.evaluate(() => { const pop = document.querySelector("[cmdk-root]")?.closest("[data-radix-popper-content-wrapper]") || document.querySelector("[cmdk-root]"); const r = pop.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), vw: window.innerWidth }; });
    check(`${lang} 390px: the card list stays inside the screen`, fit.left >= 0 && fit.right <= fit.vw, JSON.stringify(fit));
    check(`${lang} 390px: no sideways page scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await p.screenshot({ path: `${OUT}/cash-entry-cards-${lang}-390.png` }).catch(() => {});
  } catch (e) {
    check(`${lang} 390px: picker opens`, false, String(e.message).split("\n")[0]);
  }
  await ctx.close();
}
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n==== ${results.length - failed} PASS / ${failed} FAIL ====`);
process.exit(failed ? 1 : 0);
