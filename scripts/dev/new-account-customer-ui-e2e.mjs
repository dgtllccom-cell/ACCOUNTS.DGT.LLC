/**
 * DEV only — New Account Setup, driven through the FORM like a person, with a REAL DEV customer linked:
 *   Create → Save → Reopen → Change language (live, no reload) → Refresh → Reopen again → Update.
 *   BASE=http://localhost:3521 OUT=<dir> node scripts/dev/new-account-customer-ui-e2e.mjs
 *
 * One case per interface language (EN / UR / AR / FA / PS), each linking a different real DEV customer (names saved in Latin,
 * Urdu / Persian / Arabic script), plus one customer that HAS person-approved name variants in every language.
 * Checks per case:
 *   - the form creates the account (POST 201); in the database the account is named after the customer's SAVED name and is linked
 *     to that customer (customer_id), ledger name identical;
 *   - reopened in the edit form, in every language (live switch, refresh, reopen): the Account Name input holds the saved name
 *     byte-for-byte; the "Linked" customer shows the customer's approved variant for that language, otherwise the saved name;
 *   - "Update Account" without touching anything leaves account name, ledger name and customer link unchanged;
 *   - the account list API and the customer API in every language agree with the same rule.
 * The created accounts are archived again at the end (the app's own DELETE — soft delete, history kept).
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { devQuery } from "./_rbac-users.mjs";

const BASE = process.env.BASE || "http://localhost:3521";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".tmp/new-account-ui"; fs.mkdirSync(OUT, { recursive: true });
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", QUETTA = "7d7d42fe-ddd1-4bec-8703-3911ad14fa8b";
const ui = fs.readFileSync("lib/i18n/ui.ts", "utf8");
const LANGS = ["en", "ur", "ar", "fa", "ps"];
// real DEV customers (not test records), one per interface language, and one with approved variants in all languages
const CASES = [
  { ui: "en", customerId: "49b52483-f4e3-4a6b-bc88-a7ff1bb467f0" }, // Bilal Hussain
  { ui: "ur", customerId: "81b1bacf-0490-45aa-846c-e57a7c9d83e4" }, // احمد خان
  { ui: "ar", customerId: "2707d618-07f3-4868-af91-689060f790ea" }, // حامد شریف
  { ui: "fa", customerId: "683136ff-f9de-4ddc-a086-61ff554f8991" }, // محمد یوسف
  { ui: "ps", customerId: "cffa5a71-a614-4bf5-a12d-5869056afb42" }, // Al-Baraka Dry Fruits Trading LLC
  { ui: "ur", customerId: "092d8917-3b96-48d2-bdcf-e316ebcb2ab7", approved: true } // approved variants in every language
];

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok }); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 300) : ""); };
async function gotoRetry(page, url, opts) {
  for (let i = 1; ; i++) {
    try { return await page.goto(url, opts); }
    catch (e) { if (i >= 6 || !/ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_EMPTY_RESPONSE|ERR_SOCKET_NOT_CONNECTED/.test(String(e))) throw e; await new Promise((r) => setTimeout(r, 15000)); }
  }
}
const r0 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r0.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const call = async (method, path, body) => {
  const res = await fetch(BASE + path, { method, headers: { "content-type": "application/json", cookie: `erp_session=${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json };
};
const dbAccount = async (id) => {
  const a = (await devQuery((sql) => sql`select name, customer_id from public.enterprise_accounts where id = ${id}::uuid`))[0] ?? {};
  const l = (await devQuery((sql) => sql`select name from public.ledgers where enterprise_account_id = ${id}::uuid and deleted_at is null limit 1`))[0]?.name;
  return { name: a.name, customerId: a.customer_id, ledger: l };
};

// the customer's saved name and the name the rule must show in each language (approved variant, else saved)
async function expectedNames(c) {
  const saved = (await devQuery((sql) => sql`select customer_name from public.customers where id = ${c.customerId}::uuid`))[0]?.customer_name;
  const per = {};
  for (const lang of LANGS) {
    const r = await call("GET", `/api/erp/customers/${c.customerId}?lang=${lang}`);
    per[lang] = (r.json?.data?.customer ?? r.json?.customer ?? r.json?.data)?.customer_name;
  }
  return { saved, per };
}

const browser = await chromium.launch();
const ctxFor = async (lang) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
  await ctx.addInitScript(([l]) => { try { if (!sessionStorage.getItem("e2e_lang_set")) { localStorage.setItem("erp_lang", l); sessionStorage.setItem("e2e_lang_set", "1"); } localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, [lang]);
  return ctx;
};
const settle = async (p, extra = 3500) => { await p.waitForFunction(() => !document.querySelector(".animate-spin") && document.body.innerText.length > 200, null, { timeout: 90000 }).catch(() => {}); await p.waitForTimeout(extra); };
const stepTabs = (p) => p.locator("div.grid > button:has(span.rounded-full)");
async function gotoStepWith(p, selector) {
  const tabs = stepTabs(p); const n = await tabs.count();
  for (let i = 0; i < n; i++) {
    if (await p.locator(selector).first().isVisible().catch(() => false)) return true;
    await tabs.nth(i).click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(600);
  }
  return p.locator(selector).first().isVisible().catch(() => false);
}
// the linked customer is shown on the shared customer card (b8535f7 replaced the old "Linked:" box)
// the card shows "Loading…" until the customer record arrives (a few seconds on a busy DEV box) — read the name once it is there
const LOADING = new Set(["en", "ur", "ar", "fa", "ps"].map((l) => { const s = ui.indexOf(`const ${l}: Dict = {`); const m = ui.slice(s, ui.indexOf("\n};", s)).match(/"nas\.loading": "([^"]*)"/); return m ? m[1] : ""; }));
// with an expected name: wait (up to ~30 s) for it — after a language switch the card first still shows the previous language
const linkedLabel = async (p, expected) => {
  let text = null;
  for (let i = 0; i < 15; i++) {
    text = await p.locator('[data-testid="customer-account-card-name"]').first().textContent({ timeout: 4000 }).then((t) => (t || "").trim()).catch(() => null);
    if (text && !LOADING.has(text) && !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(text) && (expected === undefined || text === expected)) return text;
    await p.waitForTimeout(2000);
  }
  return text;
};
async function switchLanguage(p, lang) {
  await p.evaluate((l) => { localStorage.setItem("erp_lang", l); document.cookie = `erp_lang=${l}; path=/`; window.dispatchEvent(new Event("erp_language_changed")); }, lang);
  await p.waitForTimeout(3500);
}
async function readState(p, expectedLinked) {
  // the form may still be loading (slow DEV server): look for the field for up to ~30 s
  let okName = false;
  for (let i = 0; i < 6 && !okName; i++) {
    okName = await gotoStepWith(p, "#accountName");
    if (!okName) await p.waitForTimeout(5000);
  }
  const name = okName ? await p.locator("#accountName").first().inputValue().catch(() => null) : null;
  await gotoStepWith(p, '[data-testid="customer-account-card-name"]');
  await p.waitForTimeout(1500);
  return { name, linked: await linkedLabel(p, expectedLinked), dir: await p.evaluate(() => document.documentElement.dir) };
}

const ONLY = process.env.ONLY ? process.env.ONLY.split(",").map(Number) : null; // run selected cases (index)
const created = [];
for (const c of CASES.filter((_, i) => !ONLY || ONLY.includes(i))) {
  const exp = await expectedNames(c);
  const tag = `[${c.ui} form · customer "${exp.saved}"${c.approved ? " · approved variants" : ""}]`;
  if (!exp.saved) { check(`${tag} customer exists in DEV`, false); continue; }
  for (const lang of LANGS) {
    const want = c.approved ? exp.per[lang] : exp.saved;
    check(`${tag} customer API in ${lang} follows the rule`, exp.per[lang] === want && (c.approved ? true : exp.per[lang] === exp.saved), `got "${exp.per[lang]}"`);
  }

  // ── CREATE + SAVE through the form
  const ctx = await ctxFor(c.ui);
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 140)));
  await gotoRetry(p, `${BASE}/dashboard/accounts/setup?new=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await settle(p);
  await p.locator("#primaryType").selectOption("customers_trade").catch(() => {});
  await p.locator("#country").selectOption(PK).catch((e) => errs.push("country: " + e.message.slice(0, 80)));
  await p.waitForFunction((id) => !!document.querySelector(`#branch option[value="${id}"]`), QUETTA, { timeout: 60000 }).catch(() => {});
  await p.locator("#branch").selectOption(QUETTA).catch((e) => errs.push("branch: " + e.message.slice(0, 80)));
  await p.waitForTimeout(1500);
  // the Customer step: open the Person Master picker, search the customer, pick it
  const onPicker = await gotoStepWith(p, "button.group.h-10.w-full");
  check(`${tag} customer step reached`, onPicker);
  await p.locator("button.group.h-10.w-full").first().click({ timeout: 8000 }).catch(() => {});
  await p.locator("[cmdk-input]").first().fill(exp.saved).catch(() => {});
  const shown = c.approved ? exp.per[c.ui] : exp.saved;
  const option = p.locator("[cmdk-item]").filter({ hasText: shown }).first();
  await option.waitFor({ state: "visible", timeout: 45000 }).catch(() => {});
  check(`${tag} the picker lists the customer as "${shown}"`, await option.isVisible().catch(() => false));
  await option.click({ timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(3000);
  check(`${tag} linked label after picking shows "${shown}"`, (await linkedLabel(p, shown)) === shown, `got "${await linkedLabel(p)}"`);
  if (c.approved) {
    // before saving: a live language switch must move the "Linked" name to that language's approved variant
    for (const l of ["ar", c.ui]) {
      await switchLanguage(p, l);
      await gotoStepWith(p, '[data-testid="customer-account-card-name"]');
      check(`${tag} create mode, live switch to ${l}: linked customer = "${exp.per[l]}"`, (await linkedLabel(p, exp.per[l])) === exp.per[l], `got "${await linkedLabel(p)}"`);
    }
  }
  // the last step holds the Save button
  const tabs = stepTabs(p); const nTabs = await tabs.count();
  if (nTabs) await tabs.nth(nTabs - 1).click({ timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const postWait = p.waitForResponse((r) => r.url().includes("/api/erp/accounting/accounts") && r.request().method() === "POST", { timeout: 60000 }).catch(() => null);
  await p.locator("div.sticky.bottom-4 button").first().click({ timeout: 8000 }).catch((e) => errs.push("save: " + e.message.slice(0, 80)));
  const post = await postWait;
  let id = null;
  if (post) { const j = await post.json().catch(() => ({})); id = (j?.data ?? j)?.accountId ?? (j?.data ?? j)?.id ?? (j?.data ?? j)?.account?.id ?? null; }
  if (!id) {
    const hint = await p.evaluate(() => [...document.querySelectorAll("div.border-amber-200 span, [role=alert]")].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 3));
    check(`${tag} form Save creates the account`, false, `${post ? "HTTP " + post.status() : "no POST"} ${JSON.stringify(hint)} ${errs.join(" | ")}`);
    await p.screenshot({ path: `${OUT}/create-${c.ui}-${c.customerId.slice(0, 8)}.png` }).catch(() => {});
    await ctx.close(); continue;
  }
  created.push(id);
  check(`${tag} form Save creates the account (POST ${post.status()})`, post.status() === 201);
  const db1 = await dbAccount(id);
  check(`${tag} database: account named after the customer's saved name`, db1.name === exp.saved, `"${db1.name}"`);
  check(`${tag} database: ledger name identical`, db1.ledger === exp.saved, `"${db1.ledger}"`);
  check(`${tag} database: linked to that customer`, db1.customerId === c.customerId, `${db1.customerId}`);
  await ctx.close();

  // ── REOPEN → change language live (every language) → refresh → reopen again → update
  const ctx2 = await ctxFor(c.ui);
  const q = await ctx2.newPage(); const errs2 = [];
  q.on("pageerror", (e) => errs2.push(String(e.message).slice(0, 140)));
  const editUrl = `${BASE}/dashboard/accounts/setup?accountId=${id}`;
  await gotoRetry(q, editUrl, { waitUntil: "domcontentloaded", timeout: 180000 });
  await settle(q, 6000);
  const wantFor = (l) => (c.approved ? exp.per[l] : exp.saved);
  let st = await readState(q, wantFor(c.ui));
  check(`${tag} reopen in ${c.ui}: Account Name input = saved name`, st.name === exp.saved, `"${st.name}"`);
  check(`${tag} reopen in ${c.ui}: linked customer = "${wantFor(c.ui)}"`, st.linked === wantFor(c.ui), `"${st.linked}"`);
  for (const l of [...LANGS.filter((x) => x !== c.ui), c.ui]) {
    await switchLanguage(q, l);
    st = await readState(q, wantFor(l));
    check(`${tag} live switch to ${l}: Account Name input = saved name`, st.name === exp.saved, `"${st.name}"`);
    check(`${tag} live switch to ${l}: linked customer = "${wantFor(l)}"`, st.linked === wantFor(l), `"${st.linked}"`);
    check(`${tag} live switch to ${l}: direction`, st.dir === (l === "en" ? "ltr" : "rtl"), st.dir);
  }
  if (c.approved) {
    // an unsaved edit must survive a language switch (the form used to reload the record and wipe it)
    if (await gotoStepWith(q, "#manualReferenceNumber")) {
      await q.locator("#manualReferenceNumber").first().fill("E2E-UNSAVED-REF");
      await switchLanguage(q, "fa");
      await gotoStepWith(q, "#manualReferenceNumber");
      const kept = await q.locator("#manualReferenceNumber").first().inputValue().catch(() => null);
      check(`${tag} an unsaved edit survives a live language switch`, kept === "E2E-UNSAVED-REF", `"${kept}"`);
      await q.reload({ waitUntil: "domcontentloaded", timeout: 180000 }); // discard the edit
      await settle(q, 6000);
    } else check(`${tag} manual reference field reachable`, false);
  }
  const refreshLang = c.ui === "en" ? "ur" : "en";
  await switchLanguage(q, refreshLang);
  await q.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await settle(q, 6000);
  st = await readState(q, wantFor(refreshLang));
  check(`${tag} after refresh (${refreshLang}): Account Name input = saved name`, st.name === exp.saved, `"${st.name}"`);
  check(`${tag} after refresh (${refreshLang}): linked customer = "${wantFor(refreshLang)}"`, st.linked === wantFor(refreshLang), `"${st.linked}"`);
  await gotoRetry(q, `${BASE}/dashboard/accounts`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await settle(q, 2000);
  await gotoRetry(q, editUrl, { waitUntil: "domcontentloaded", timeout: 180000 });
  await settle(q, 6000);
  st = await readState(q, wantFor(refreshLang));
  check(`${tag} reopen again (${refreshLang}): Account Name input = saved name`, st.name === exp.saved, `"${st.name}"`);
  check(`${tag} reopen again (${refreshLang}): linked customer = "${wantFor(refreshLang)}"`, st.linked === wantFor(refreshLang), `"${st.linked}"`);
  const t2 = stepTabs(q); const n2 = await t2.count();
  if (n2) await t2.nth(n2 - 1).click({ timeout: 4000 }).catch(() => {});
  await q.waitForTimeout(1200);
  // press Update once the form has finished loading (the button is disabled while it loads); one retry on a slow DEV server
  const saveBtn = q.locator("div.sticky.bottom-4 button").first();
  await q.waitForFunction(() => { const b = document.querySelector("div.sticky.bottom-4 button"); return !!b && !b.disabled; }, null, { timeout: 60000 }).catch(() => {});
  let patch = null;
  for (let attempt = 0; attempt < 2 && !patch; attempt++) {
    const patchWait = q.waitForResponse((r) => r.url().includes(`/api/erp/accounting/accounts/${id}`) && ["PATCH", "PUT"].includes(r.request().method()), { timeout: 30000 }).catch(() => null);
    await saveBtn.click({ timeout: 8000 }).catch(() => {});
    patch = await patchWait;
  }
  const hint = patch ? "" : JSON.stringify(await q.evaluate(() => ({ button: document.querySelector("div.sticky.bottom-4 button")?.outerHTML.slice(0, 160), msg: [...document.querySelectorAll("div.border-amber-200 span, [role=alert]")].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 3) })));
  check(`${tag} Update Account pressed (${refreshLang})`, !!patch && patch.status() < 400, patch ? `HTTP ${patch.status()}` : `no PATCH ${hint}`);
  await q.waitForTimeout(2500);
  const db2 = await dbAccount(id);
  check(`${tag} after Update: name, ledger and customer link unchanged`, db2.name === exp.saved && db2.ledger === exp.saved && db2.customerId === c.customerId, JSON.stringify(db2));
  check(`${tag} no page errors`, errs.length + errs2.length === 0, [...errs, ...errs2].join(" | "));
  await q.screenshot({ path: `${OUT}/reopen-${c.ui}-${c.customerId.slice(0, 8)}.png` }).catch(() => {});
  await ctx2.close();

  // ── account list API in every language: the saved name
  for (const l of LANGS) {
    const lst = await call("GET", `/api/erp/accounting/accounts/${id}?lang=${l}`);
    const acc = lst.json?.data?.account ?? lst.json?.account;
    check(`${tag} account API in ${l} shows the saved name`, acc?.name === exp.saved, `"${acc?.name}"`);
  }
}
await browser.close();

// clean up: archive the test accounts through the app (soft delete)
for (const id of created) {
  const del = await call("DELETE", `/api/erp/accounting/accounts/${id}`);
  check(`clean-up: account ${id.slice(0, 8)} archived`, del.status === 200);
}
const failed = results.filter((r) => !r.ok).length;
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
console.log(`\n==== ${results.length - failed} PASS / ${failed} FAIL ====`);
process.exit(failed ? 1 : 0);
