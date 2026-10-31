/**
 * DEV only — issue #36: data typed in Urdu / Pashto (and English) read in every language, EN / UR / AR / FA / PS.
 *   BASE=http://localhost:3521 OUT=<dir> node scripts/dev/saved-data-language-e2e.mjs
 *
 * Creates its own records through the real save APIs (an Urdu customer + address, a Pashto customer, an English customer and an
 * Urdu account), then checks the owner's rules end to end:
 *  - before approval every language shows the SAVED text (never a machine re-spelling), marked as not in the viewer's language;
 *  - the Translation Management review queue lists the values with suggestions; approving stores only what the person confirmed;
 *  - after approval the approved version shows in that language on the APIs and the screens (Customer Register, Party Directory,
 *    Account view), the saved text everywhere else, a live language switch and a reload follow the language, and
 *    searching by the saved text still finds the record;
 *  - a term typed in Urdu (contact type / category word) reads as the approved dictionary term.
 * The records are archived through the app at the end.
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { devQuery } from "./_rbac-users.mjs";

const BASE = process.env.BASE || "http://localhost:3521";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".tmp/saved-data-language"; fs.mkdirSync(OUT, { recursive: true });
const LANGS = ["en", "ur", "ar", "fa", "ps"];
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", PK_MAIN = "5269c1cb-92a1-4aa8-aad8-d4c7260badaa", QUETTA = "7d7d42fe-ddd1-4bec-8703-3911ad14fa8b";
const RUN_LATIN = String(Date.now()).slice(-4);
const RUN = RUN_LATIN.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]); // keeps each run's names unique (Urdu digits in the Urdu / Pashto names)

const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 240) : ""); };
const r0 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r0.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const call = async (method, path, body, lang = "en") => {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(BASE + path, { method, headers: { "content-type": "application/json", cookie: `erp_session=${token}; erp_lang=${lang}` }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
      return { status: res.status, json };
    } catch (e) { if (attempt === 3) throw e; await new Promise((r) => setTimeout(r, 10000)); }
  }
};
const customerName = async (id, lang) => {
  const r = await call("GET", `/api/erp/customers/${id}?lang=${lang}`, undefined, lang);
  return (r.json?.data?.customer ?? r.json?.customer ?? r.json?.data)?.customer_name;
};
const directoryRow = async (q, lang, id) => {
  const r = await call("GET", `/api/erp/parties/directory?lang=${lang}&q=${encodeURIComponent(q)}&limit=50`, undefined, lang);
  return (r.json?.data?.parties ?? r.json?.parties ?? []).find((p) => p.customerId === id) ?? null;
};
const reviewQueue = async (q, needLang) => {
  const r = await call("GET", `/api/erp/translations/management?review=true&needLang=${needLang}&q=${encodeURIComponent(q)}&limit=100`);
  return r.json?.data?.items ?? [];
};
const approve = (recordTable, recordId, fieldName, translations) =>
  call("POST", "/api/erp/translations/management", { review: true, recordTable, recordId, fieldName, translations });
const storedRow = async (table, id, field) => (await devQuery((sql) => sql`select original_text, original_language_code, english_text, urdu_text, source::text as source, translation_status, translated_by_engine, corrected_by
  from public.record_translations where record_table = ${table} and record_id = ${id}::uuid and field_name = ${field} and deleted_at is null limit 1`))[0];

// ── 1. CREATE through the real save paths ───────────────────────────────────────────────────────────────────────────────
const people = [
  { key: "ur", name: `حاجی نعمت اللہ بادام والا ${RUN}`, address: `مال روڈ چمن ${RUN}`, lang: "ur", approveIn: "en", approved: "Haji Naimatullah Badam Wala", approvedAddress: "Mall Road, Chaman" },
  { key: "ps", name: `ګل محمد ځدراڼ ${RUN}`, address: `د کندهار لویه لاره ${RUN}`, lang: "ps", approveIn: "en", approved: "Gul Muhammad Zadran" },
  { key: "en", name: `Bilal Trader Test ${RUN_LATIN}`, address: `Mall Road Chaman ${RUN_LATIN}`, lang: "en", approveIn: "ur", approved: "بلال ٹریڈر ٹیسٹ" }
];
for (const person of people) {
  const r = await call("POST", "/api/erp/customers", {
    countryId: PK, countryBranchId: PK_MAIN, cityBranchId: QUETTA, customerName: person.name, address: person.address, originalLanguage: person.lang,
    contacts: [{ type: "Mobile", value: "+92 300 5550000" }]
  }, person.lang);
  person.id = (r.json?.data ?? r.json)?.customerId;
  check(`[create] customer typed in ${person.lang} saved`, r.status < 300 && !!person.id, `status ${r.status}`);
}
const account = { name: `نعمت اللہ بروکر کھاتہ ${RUN}`, approved: "Naimatullah Broker Account" };
{
  const r = await call("POST", "/api/erp/accounting/accounts", { scope: "city_branch", countryId: PK, countryBranchId: PK_MAIN, cityBranchId: QUETTA, operationalDomain: "business", code: "AUTO", name: account.name, kind: "asset", currency: "PKR", openingBalance: 0, contacts: [{ type: "Mobile", value: "+923005550000" }] }, "ur");
  account.id = (r.json?.data ?? r.json)?.accountId ?? (r.json?.data ?? r.json)?.id;
  check("[create] account named in Urdu saved", r.status < 300 && !!account.id, `status ${r.status}`);
  account.ledgerId = (await devQuery((sql) => sql`select id::text as id from public.ledgers where enterprise_account_id = ${account.id}::uuid and deleted_at is null limit 1`))[0]?.id;
}
await new Promise((r) => setTimeout(r, 3000)); // the translation enrolment runs right after the save

// ── 2. BEFORE approval: every language shows the saved text ───────────────────────────────────────────────────────────
for (const person of people) {
  const row = await storedRow("customers", person.id, "customer_name");
  check(`[enrol] ${person.key} name enrolled for translation`, !!row && row.original_text === person.name, row ? `${row.source}/${row.translation_status}` : "no row");
  for (const lang of LANGS) {
    const shown = await customerName(person.id, lang);
    check(`[before] ${person.key} customer API in ${lang} shows the saved name`, shown === person.name, `got "${shown}"`);
  }
  const addr = await storedRow("customers", person.id, "address");
  check(`[enrol] ${person.key} address enrolled for translation`, !!addr && addr.original_text === person.address);
}
for (const lang of LANGS) {
  const r = await call("GET", `/api/erp/accounting/accounts/${account.id}?lang=${lang}`, undefined, lang);
  const shown = r.json?.data?.account?.name;
  check(`[before] Urdu account in ${lang} shows the saved name (no "Namt Allah" re-spelling)`, shown === account.name, `got "${shown}"`);
}

// ── 3. REVIEW QUEUE lists them with suggestions ─────────────────────────────────────────────────────────────────────
const urItem = (await reviewQueue(people[0].name, "en")).find((i) => i.recordId === people[0].id && i.fieldName === "customer_name");
check("[review] Urdu customer name waits for an approved English name", !!urItem && urItem.kind === "name" && urItem.originalLanguageCode === "ur", JSON.stringify(urItem ?? {}).slice(0, 200));
check("[review] English suggestion is readable (Naimatullah, not Namt Allah)", /Naimatullah/.test(urItem?.suggestions?.en ?? ""), urItem?.suggestions?.en);
const psItem = (await reviewQueue(people[1].name, "en")).find((i) => i.recordId === people[1].id && i.fieldName === "customer_name");
check("[review] Pashto customer name waits, saved in Pashto", !!psItem && psItem.originalLanguageCode === "ps");
const enItem = (await reviewQueue(people[2].name, "ur")).find((i) => i.recordId === people[2].id && i.fieldName === "customer_name");
check("[review] English customer name waits for an approved Urdu name", !!enItem && enItem.originalLanguageCode === "en");
const accItem = (await reviewQueue(account.name, "en")).find((i) => i.recordId === account.id);
check("[review] Urdu account name waits for an approved English name", !!accItem && accItem.kind === "name");
const addrItem = (await reviewQueue(people[0].address, "en")).find((i) => i.recordId === people[0].id && i.fieldName === "address");
check("[review] Urdu address waits as text", !!addrItem && addrItem.kind === "text");

// ── 4. UI before approval + approve the Urdu customer through the review screen (Accept a typed value) ─────────────────
const browser = await chromium.launch();
const ctxFor = async (lang) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
  await ctx.addInitScript((l) => { try { if (!sessionStorage.getItem("e2e_lang_set")) { localStorage.setItem("erp_lang", l); sessionStorage.setItem("e2e_lang_set", "1"); } localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, lang);
  return ctx;
};
const gotoRetry = async (p, url) => {
  for (let i = 0; ; i++) {
    try { return await p.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 }); }
    catch (e) { if (i >= 5 || !/ERR_CONNECTION|ERR_EMPTY_RESPONSE|ERR_SOCKET/.test(String(e))) throw e; await new Promise((r) => setTimeout(r, 15000)); }
  }
};
async function registerSearch(p, q) {
  if (!(await p.locator("div.space-y-3 input[type=text]").first().isVisible().catch(() => false))) await p.locator("button.h-9.rounded-xl:has(svg.lucide-search)").first().click().catch(() => {});
  const input = p.locator("div.space-y-3 input[type=text]").first();
  await input.waitFor({ timeout: 30000 });
  await input.fill(q);
  await p.waitForTimeout(3000);
}
const pendingMarks = (p, text) => p.evaluate((t) => [...document.querySelectorAll("[data-translation-pending]")].filter((el) => el.textContent.includes(t)).map((el) => el.getAttribute("data-saved-lang")), text);
const bodyHas = async (p, text, tries = 10) => { for (let i = 0; i < tries; i++) { if ((await p.evaluate(() => document.body.innerText)).includes(text)) return true; await p.waitForTimeout(3000); } return false; };

{
  const ctx = await ctxFor("en"); const p = await ctx.newPage();
  await gotoRetry(p, `${BASE}/dashboard/customers`);
  await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await registerSearch(p, people[0].name);
  check("[before UI] Customer Register EN shows the saved Urdu name", await bodyHas(p, people[0].name));
  check("[before UI] … marked as saved in Urdu (no approved English yet)", (await pendingMarks(p, people[0].name)).includes("ur"));
  await p.screenshot({ path: `${OUT}/register-en-before.png` }).catch(() => {});
  await ctx.close();
}
{
  const ctx = await ctxFor("en"); const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 140)));
  await gotoRetry(p, `${BASE}/dashboard/settings/translations`);
  await p.locator('[data-testid="review-search"]').waitFor({ timeout: 90000 });
  check("[review UI] the review queue opens by default", await p.locator('[data-testid="trm-tab-review"][aria-selected="true"]').isVisible().catch(() => false));
  await p.locator('[data-testid="review-search"]').fill(people[0].name);
  await p.locator('[data-testid="review-search"]').press("Enter");
  const row = p.locator(`[data-testid="review-row"][data-record-id="${people[0].id}"][data-field="customer_name"]`);
  await row.waitFor({ timeout: 60000 }).catch(() => {});
  check("[review UI] the Urdu customer name is listed", await row.isVisible().catch(() => false));
  await row.locator('[data-testid="review-edit"]').click().catch(() => {});
  await p.locator('[data-testid="review-input-en"]').fill(people[0].approved).catch(() => {});
  await p.locator('[data-testid="review-approve"]').click().catch(() => {});
  await p.locator('[data-testid="review-message"]').waitFor({ timeout: 60000 }).catch(() => {});
  const msg = await p.locator('[data-testid="review-message"]').textContent().catch(() => "");
  check("[review UI] approve confirms", /Approved/.test(msg || ""), msg);
  await p.screenshot({ path: `${OUT}/review-queue-en.png` }).catch(() => {});
  check("[review UI] no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
const urRow = await storedRow("customers", people[0].id, "customer_name");
check("[approve] stored as the person's entry, saved name unchanged", urRow?.source === "manual" && urRow?.english_text === people[0].approved && urRow?.original_text === people[0].name && urRow?.urdu_text === people[0].name, `${urRow?.source} en="${urRow?.english_text}"`);

// the rest through the review API
check("[approve] Urdu address → English", (await approve("customers", people[0].id, "address", { en: people[0].approvedAddress })).status < 300);
check("[approve] Pashto name → English", (await approve("customers", people[1].id, "customer_name", { en: people[1].approved })).status < 300);
check("[approve] English name → Urdu", (await approve("customers", people[2].id, "customer_name", { ur: people[2].approved })).status < 300);
const accApproval = await approve("enterprise_accounts", account.id, "name", { en: account.approved });
check("[approve] Urdu account name → English, applied to its ledger too", accApproval.status < 300 && Number(accApproval.json?.data?.pairedRecords) >= 1, JSON.stringify(accApproval.json?.data ?? accApproval.json).slice(0, 160));
const sameText = await approve("customers", people[1].id, "customer_name", { en: people[1].name });
check("[approve] copying the saved text is refused (not a translation)", sameText.status >= 400);

// ── 5. AFTER approval: APIs in all five languages ───────────────────────────────────────────────────────────────────
for (const person of people) {
  for (const lang of LANGS) {
    const want = lang === person.approveIn ? person.approved : person.name;
    const shown = await customerName(person.id, lang);
    check(`[after] ${person.key} customer API in ${lang} shows ${lang === person.approveIn ? "the approved name" : "the saved name"}`, shown === want, `got "${shown}"`);
  }
}
for (const lang of LANGS) {
  const want = lang === "en" ? account.approved : account.name;
  const r = await call("GET", `/api/erp/accounting/accounts/${account.id}?lang=${lang}`, undefined, lang);
  check(`[after] account API in ${lang}`, r.json?.data?.account?.name === want, `got "${r.json?.data?.account?.name}"`);
  if (account.ledgerId) {
    const lr = await devQuery((sql) => sql`select english_text, source::text as source from public.record_translations where record_table = 'ledgers' and record_id = ${account.ledgerId}::uuid and field_name = 'name' and deleted_at is null limit 1`);
    if (lang === "en") check("[after] the account's ledger carries the same approved English name", lr[0]?.english_text === account.approved && lr[0]?.source === "manual", JSON.stringify(lr[0] ?? {}));
  }
}
for (const lang of LANGS) {
  const row = await directoryRow(people[0].name, lang, people[0].id);
  check(`[after] Party Directory ${lang}: search by the saved Urdu name finds the party`, !!row);
  check(`[after] Party Directory ${lang}: name`, row?.customerName === (lang === "en" ? people[0].approved : people[0].name), `got "${row?.customerName}"`);
  check(`[after] Party Directory ${lang}: address`, row?.address === (lang === "en" ? people[0].approvedAddress : people[0].address), `got "${row?.address}"`);
}
check("[after] Party Directory EN: search by the approved English name finds the party", !!(await directoryRow("Naimatullah", "en", people[0].id)));
check("[after] customers search by the saved Urdu name in EN", ((await call("GET", `/api/erp/customers?lang=en&q=${encodeURIComponent(people[0].name)}&limit=20`)).json?.data?.customers ?? []).some((c) => c.id === people[0].id));
check("[after] customers search by the approved English name in EN", ((await call("GET", `/api/erp/customers?lang=en&q=${encodeURIComponent("Naimatullah")}&limit=20`)).json?.data?.customers ?? []).some((c) => c.id === people[0].id));
check("[after] the review queue no longer lists the approved English name", !(await reviewQueue(people[0].name, "en")).some((i) => i.recordId === people[0].id && i.fieldName === "customer_name"));
check("[after] … but still lists it for Arabic (not approved there)", (await reviewQueue(people[0].name, "ar")).some((i) => i.recordId === people[0].id && i.fieldName === "customer_name"));

// ── 6. AFTER approval: screens, live switch, reload ─────────────────────────────────────────────────────────────────
{
  const ctx = await ctxFor("en"); const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 140)));
  await gotoRetry(p, `${BASE}/dashboard/customers`);
  await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await registerSearch(p, people[0].name);
  check("[after UI] Customer Register EN shows the approved English name", await bodyHas(p, people[0].approved));
  check("[after UI] … with no 'pending' marker on it", (await pendingMarks(p, people[0].approved)).length === 0);
  await p.screenshot({ path: `${OUT}/register-en-after.png` }).catch(() => {});
  // live switch to Urdu: the saved Urdu name, no reload
  await p.evaluate(() => { localStorage.setItem("erp_lang", "ur"); document.cookie = "erp_lang=ur; path=/"; window.dispatchEvent(new Event("erp_language_changed")); });
  check("[after UI] live switch EN→UR shows the saved Urdu name", await bodyHas(p, people[0].name, 12));
  await p.reload({ waitUntil: "domcontentloaded", timeout: 180000 }).catch(() => {});
  await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await registerSearch(p, people[0].name);
  check("[after UI] reload keeps Urdu (saved name, RTL)", (await bodyHas(p, people[0].name)) && (await p.evaluate(() => document.documentElement.dir)) === "rtl");
  check("[after UI] Customer Register: no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
for (const lang of ["en", "ps"]) {
  const ctx = await ctxFor(lang); const p = await ctx.newPage();
  await gotoRetry(p, `${BASE}/dashboard/customers?view=journal`);
  await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  const want = lang === "en" ? people[1].approved : people[1].name;
  check(`[after UI] Party Directory ${lang} lists the Pashto customer as "${want}"`, await bodyHas(p, want, 12));
  await ctx.close();
}
for (const lang of ["en", "ur"]) {
  const ctx = await ctxFor(lang); const p = await ctx.newPage();
  await gotoRetry(p, `${BASE}/dashboard/accounts/view?accountId=${account.id}`);
  await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  const want = lang === "en" ? account.approved : account.name;
  check(`[after UI] Account view ${lang} shows "${want}"`, await bodyHas(p, want, 12));
  await p.screenshot({ path: `${OUT}/account-report-${lang}.png` }).catch(() => {});
  await ctx.close();
}
await browser.close();

// ── 7. terms typed in Urdu read as the approved term ────────────────────────────────────────────────────────────────
{
  const cat = await call("POST", "/api/erp/account-categories", { name: "گودام", description: "گودام", code: `E2E-${Date.now().toString(36)}`, countryId: PK }, "ur");
  const catId = (cat.json?.data ?? cat.json)?.category?.id ?? (cat.json?.data ?? cat.json)?.id;
  if (cat.status < 300 && catId) {
    const list = await call("GET", `/api/erp/account-categories?lang=en`, undefined, "en");
    const rows = list.json?.data?.categories ?? list.json?.data ?? list.json?.categories ?? [];
    const row = (Array.isArray(rows) ? rows : []).find((r) => r.id === catId);
    check("[term] an account category named \"گودام\" reads \"Warehouse\" in English", row?.name === "Warehouse", `got "${row?.name}"`);
    await call("DELETE", `/api/erp/account-categories/${catId}`).catch(() => {});
  } else {
    console.log("SKIP [term] account category create not available:", cat.status);
  }
}

// ── cleanup (archive through the app) ──────────────────────────────────────────────────────────────────────────────
if (account.id) await call("DELETE", `/api/erp/accounting/accounts/${account.id}`);
for (const person of people) if (person.id) await call("DELETE", `/api/erp/customers/${person.id}`);

const failed = results.filter((x) => !x).length;
console.log(`\n==== ${results.length - failed} PASS / ${failed} FAIL ====`);
process.exit(failed ? 1 : 0);
