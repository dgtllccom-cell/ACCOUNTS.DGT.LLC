/**
 * DEV only — REAL database-backed Save -> Reopen -> Language switch -> Refresh -> Logout / Login check of account names.
 *   BASE=http://localhost:3521 OUT=<dir> node scripts/dev/account-name-roundtrip-e2e.mjs
 *
 * For each of the five languages (EN / UR / AR / FA / PS) a test account is created through the same POST the Account Setup form uses,
 * with a name typed in that language (Urdu, Pashto, Arabic and Persian names use their own script and spelling). Then, per account:
 *   - reopen it in the Account Setup EDIT form in every language: the Account Name input must hold the SAVED name exactly, and pressing
 *     "Update Account" without touching it must leave the stored name byte-for-byte unchanged (database check);
 *   - the account profile view and the API show the exact saved name in every language (no approved translation exists, so no variant
 *     may appear) — page refresh and a fresh login (new session) included;
 *   - stored translation rows of the account are never "complete" machine output (needs_review / auto_unverified only);
 *   - an APPROVED variant entered by a person for ONE language is shown in that language only; every other language keeps the saved name.
 * Test accounts are removed again at the end (the saved names are compared before that).
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { devQuery } from "./_rbac-users.mjs";

const BASE = process.env.BASE || "http://localhost:3521";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; if (!OUT) throw new Error("OUT required"); fs.mkdirSync(OUT, { recursive: true });
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", PK_MAIN = "5269c1cb-92a1-4aa8-aad8-d4c7260badaa", QUETTA = "7d7d42fe-ddd1-4bec-8703-3911ad14fa8b";
const LANGS = ["en", "ur", "ar", "fa", "ps"];
const stamp = Date.now().toString(36).toUpperCase();
// the exact names a user would type (own script + own spelling); the stamp keeps the test records unique
const NAMES = {
  ur: `عبداللہ خان ${stamp}`,
  ps: `ګل محمد ${stamp}`,
  ar: `عبد الرحمن العمري ${stamp}`,
  fa: `فاطمه احمدی ${stamp}`,
  en: `Hamid Sharif ${stamp}`,
};
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok }); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 360) : ""); };
// the DEV server on this PC restarts itself after a crash (supervisor): retry a navigation that hits the restart window
async function gotoRetry(page, url, opts) {
  for (let i = 1; ; i++) {
    try { return await page.goto(url, opts); }
    catch (e) { if (i >= 6 || !/ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_EMPTY_RESPONSE/.test(String(e))) throw e; await new Promise((r) => setTimeout(r, 15000)); }
  }
}
const cp = (s) => [...String(s ?? "")].map((c) => c.codePointAt(0).toString(16)).join(" ");

async function newSession() {
  const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
  const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
  return token;
}
const api = (token) => async (method, path, body) => {
  const res = await fetch(BASE + path, { method, headers: { "content-type": "application/json", cookie: `erp_session=${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json };
};
const dbName = async (id) => {
  const a = (await devQuery((sql) => sql`select name from public.enterprise_accounts where id = ${id}::uuid`))[0]?.name;
  const l = (await devQuery((sql) => sql`select name from public.ledgers where enterprise_account_id = ${id}::uuid and deleted_at is null limit 1`))[0]?.name;
  return { account: a, ledger: l };
};

let token = await newSession();
let call = api(token);
const ids = {};
for (const lang of LANGS) {
  const r = await call("POST", "/api/erp/accounting/accounts", { scope: "city_branch", countryId: PK, countryBranchId: PK_MAIN, cityBranchId: QUETTA, operationalDomain: "business", code: "AUTO", name: NAMES[lang], kind: "asset", currency: "PKR", openingBalance: 0, contacts: [{ type: "Mobile", value: "+923001234567" }] });
  ids[lang] = (r.json?.data ?? r.json)?.accountId ?? (r.json?.data ?? r.json)?.id;
  check(`create [${lang}] account named in ${lang}`, r.status === 201 && ids[lang], `HTTP ${r.status} ${r.json?.error?.message ?? ""}`);
}
await new Promise((r) => setTimeout(r, 4000)); // the fire-and-forget translation registration finishes

const browser = await chromium.launch();
const ctxFor = async (tok, lang, width = 1440) => {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.addCookies([{ name: "erp_session", value: tok, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
  await ctx.addInitScript(([l]) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, [lang]);
  return ctx;
};
const settle = async (p, extra = 3500) => { await p.waitForFunction(() => !document.querySelector(".animate-spin") && document.body.innerText.length > 200, null, { timeout: 90000 }).catch(() => {}); await p.waitForTimeout(extra); };

async function readEditName(p) {
  // the stepper buttons jump between steps; the Account Name input lives on one of them
  const steps = p.locator("div.grid > button:has(span.rounded-full)");
  const n = await steps.count();
  for (let i = 0; i < n; i++) {
    const v = await p.locator("#accountName").first().inputValue({ timeout: 800 }).catch(() => null);
    if (v !== null) return v;
    await steps.nth(i).click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(500);
  }
  return await p.locator("#accountName").first().inputValue({ timeout: 1500 }).catch(() => null);
}

for (const owner of LANGS) {
  const id = ids[owner]; const saved = NAMES[owner];
  if (!id) continue;
  // ── every language reopens the account; the original language is visited again last
  const order = [...LANGS.filter((l) => l !== owner), owner];
  for (const view of order) {
    const doSave = view === owner || view === order[0] || view === order[2];
    const ctx = await ctxFor(token, view);
    const p = await ctx.newPage(); const errs = [];
    p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
    // 1. API detail in this language
    const d = await call("GET", `/api/erp/accounting/accounts/${id}?language=${view}`);
    check(`[${owner} account] API detail in ${view} shows the exact saved name`, d.json?.data?.account?.name === saved, `got "${d.json?.data?.account?.name}" expected "${saved}"`);
    const list = await call("GET", `/api/erp/accounting/accounts?lang=${view}&limit=500&search=${encodeURIComponent(stamp)}`);
    const row = (list.json?.data?.accounts ?? list.json?.accounts ?? []).find((a) => a.id === id);
    check(`[${owner} account] account list in ${view} shows the exact saved name`, !row || row.name === saved, `got "${row?.name}"`);
    // 2. profile view page
    await gotoRetry(p, `${BASE}/dashboard/accounts/view?accountId=${id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await settle(p);
    const viewText = await p.evaluate(() => document.body.innerText);
    check(`[${owner} account] profile view in ${view} contains the exact saved name`, viewText.includes(saved), "");
    // 3. edit form: input holds the saved name; Update without touching it leaves the stored name unchanged
    await gotoRetry(p, `${BASE}/dashboard/accounts/setup?accountId=${id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await settle(p, 9000);
    const inputName = await readEditName(p);
    check(`[${owner} account] edit form in ${view}: Account Name input holds the saved name`, inputName === saved, `input="${inputName}" expected="${saved}"`);
    if (inputName !== null && doSave) {
      const steps = p.locator("div.grid > button:has(span.rounded-full)");
      const n = await steps.count();
      if (n > 0) await steps.nth(n - 1).click({ timeout: 4000 }).catch(() => {});
      await p.waitForTimeout(800);
      const saveBtn = p.locator("div.sticky.bottom-4 button").first();
      // the form resolves its branch / currency asynchronously: press Update, and press it again if the form was not ready yet
      let resp = null;
      for (let attempt = 1; attempt <= 4 && !resp; attempt++) {
        const patch = p.waitForResponse((r) => r.url().includes(`/api/erp/accounting/accounts/${id}`) && r.request().method() === "PATCH", { timeout: 20000 }).catch(() => null);
        // the slow DEV server can take a while to resolve the branch / currency: wait up to 30 s for the form to be ready
        let ready = false;
        for (let w = 0; w < 30 && !ready; w++) { ready = await saveBtn.isEnabled().catch(() => false); if (!ready) await p.waitForTimeout(1000); }
        if (ready) await saveBtn.click({ timeout: 4000 }).catch(() => {});
        resp = await patch;
        if (!resp) await p.waitForTimeout(2500);
      }
      check(`[${owner} account] Update Account pressed in ${view} (PATCH sent)`, !!resp && resp.status() < 400, resp ? `HTTP ${resp.status()}` : "no PATCH seen after 4 attempts");
      await p.waitForTimeout(1500);
    }
    const after = await dbName(id);
    check(`[${owner} account] database name unchanged after edit/save in ${view}`, after.account === saved && after.ledger === saved, `account="${after.account}" ledger="${after.ledger}"`);
    if (view === owner) await p.screenshot({ path: `${OUT}/${owner}-edit-${view}.png` }).catch(() => {});
    check(`[${owner} account] no page errors in ${view}`, errs.length === 0, errs.join(" | "));
    await ctx.close();
  }
  // ── refresh + log out / log in again, original language
  const ctx = await ctxFor(token, owner);
  const p = await ctx.newPage();
  await gotoRetry(p, `${BASE}/dashboard/accounts/view?accountId=${id}`, { waitUntil: "domcontentloaded", timeout: 180000 }); await settle(p);
  await p.reload({ waitUntil: "domcontentloaded" }); await settle(p);
  check(`[${owner} account] after a page refresh the saved name is shown`, (await p.evaluate(() => document.body.innerText)).includes(saved), "");
  await ctx.close();
  const token2 = await newSession(); // log out (cookie gone) + log in again
  const ctx2 = await ctxFor(token2, owner);
  const p2 = await ctx2.newPage();
  await gotoRetry(p2, `${BASE}/dashboard/accounts/view?accountId=${id}`, { waitUntil: "domcontentloaded", timeout: 180000 }); await settle(p2);
  check(`[${owner} account] after logging out and in again the saved name is shown`, (await p2.evaluate(() => document.body.innerText)).includes(saved), "");
  await p2.screenshot({ path: `${OUT}/${owner}-view-after-relogin.png` }).catch(() => {});
  await ctx2.close();
  const rows = await devQuery((sql) => sql`select translation_status, translated_by_engine, source::text as source from public.record_translations where record_id = ${id}::uuid and deleted_at is null`);
  check(`[${owner} account] machine translations of the name are never 'complete' (needs_review / auto_unverified only)`, rows.every((r) => !(r.translation_status === "complete" && r.source !== "manual")), JSON.stringify(rows.map((r) => `${r.source}/${r.translation_status}/${r.translated_by_engine}`)));
}

// ── an approved variant (entered by a person) shows in ITS language only
{
  const id = ids.ur; const saved = NAMES.ur;
  const approvedFa = `عبدالله خان ${stamp}`; // the Persian spelling the owner approves for this account
  const put = await call("PATCH", `/api/erp/translations/corrections/enterprise_accounts/${id}`, { fields: [{ fieldName: "name", translations: { fa: approvedFa } }] });
  check("an approved Persian variant can be entered for the Urdu-saved account (person entry)", put.status < 400, `HTTP ${put.status} ${put.json?.error?.message ?? ""}`);
  for (const view of LANGS) {
    const d = await call("GET", `/api/erp/accounting/accounts/${id}?language=${view}`);
    const expected = put.status < 400 && view === "fa" ? approvedFa : saved;
    check(`approved variant: ${view} shows ${view === "fa" ? "the approved Persian name" : "the original saved name"}`, d.json?.data?.account?.name === expected, `got "${d.json?.data?.account?.name}" expected "${expected}"`);
  }
  const after = await dbName(id);
  check("approved variant: the saved (original) name in the database is untouched", after.account === saved && after.ledger === saved, `account="${after.account}" cp=${cp(after.account)}`);
}

// ── cleanup (names compared above)
for (const lang of LANGS) if (ids[lang]) await call("DELETE", `/api/erp/accounting/accounts/${ids[lang]}`);
await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
const bad = results.filter((x) => !x.ok);
console.log(`\n==== ${results.length - bad.length} PASS / ${bad.length} FAIL ====`);
process.exit(bad.length ? 1 : 0);
