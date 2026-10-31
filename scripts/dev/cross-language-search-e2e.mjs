/**
 * DEV only — Priority 1: a name saved in ONE language is shown in, and found by, EVERY language (5 source × 5 display / search).
 *   BASE=http://localhost:3546 OUT=<dir> node scripts/dev/cross-language-search-e2e.mjs
 *
 * Creates five customers and five accounts through the real save APIs — each entity typed in a different language
 * (English / Urdu / Arabic / Farsi / Pashto) — and approves the spelling in the other four languages through the
 * Translation Management review API (what the owner's reviewer does; DEV test data only). Then, for all 25
 * (saved-in × viewed-in) combinations it checks:
 *   DISPLAY  the account API, the customer API, the Accounts General Report and the Party Directory show the approved
 *            spelling in the viewer's language (the saved text when the viewer's language is the language it was saved in);
 *   SEARCH   typing that spelling in the viewer's language finds the record in the Accounts General Report, the Ledger
 *            list, the Party Directory and the global search.
 * Run it against two builds to get a BEFORE / AFTER: results go to <OUT>/cross-language-search.json.
 * The records are archived through the app at the end.
 */
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3546";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".tmp/cross-language-search"; fs.mkdirSync(OUT, { recursive: true });
const LANGS = ["en", "ur", "ar", "fa", "ps"];
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", PK_MAIN = "5269c1cb-92a1-4aa8-aad8-d4c7260badaa", QUETTA = "7d7d42fe-ddd1-4bec-8703-3911ad14fa8b";
const digits = { en: "0123456789", ur: "۰۱۲۳۴۵۶۷۸۹", fa: "۰۱۲۳۴۵۶۷۸۹", ps: "۰۱۲۳۴۵۶۷۸۹", ar: "٠١٢٣٤٥٦٧٨٩" };
const RUN = String(Date.now()).slice(-4);
const tag = (lang) => RUN.replace(/\d/g, (d) => digits[lang][d]);

// one entity per saved-in language; the spelling of the SAME name in each language (hand-written DEV test data)
const ENTITIES = [
  { saved: "en", names: { en: "Zarmeen Traders", ur: "زرمین ٹریڈرز", ar: "زرمين للتجارة", fa: "زرمین بازرگانی", ps: "زرمین سوداګر" } },
  { saved: "ur", names: { en: "Naseem Brothers", ur: "نسیم برادرز", ar: "نسيم إخوان", fa: "نسیم برادران", ps: "نسیم وروڼه" } },
  { saved: "ar", names: { en: "Rahman Exports", ur: "رحمان ایکسپورٹس", ar: "الرحمن للتصدير", fa: "رحمان صادرات", ps: "رحمان صادرات پښتو" } },
  { saved: "fa", names: { en: "Behroz Carpets", ur: "بہروز کارپٹس", ar: "بهروز للسجاد", fa: "بهروز فرش", ps: "بهروز غالۍ" } },
  { saved: "ps", names: { en: "Sherzad Ghulam", ur: "شیرزاد غلام", ar: "شيرزاد غلام", fa: "شیرزاد غلام فارسی", ps: "شیرزاد غلام ګل" } }
];
for (const e of ENTITIES) for (const l of LANGS) e.names[l] = `${e.names[l]} ${tag(l)}`;
const spelling = (e, lang) => e.names[lang];

const results = [];
const check = (group, name, ok, detail = "") => { results.push({ group, name, ok: !!ok, detail: String(detail).slice(0, 200) }); console.log(ok ? "PASS" : "FAIL", name, ok || !detail ? "" : "· " + String(detail).slice(0, 160)); };

const r0 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r0.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const call = async (method, path, body, lang = "en") => {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(BASE + path, { method, headers: { "content-type": "application/json", cookie: `erp_session=${token}; erp_lang=${lang}` }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(90000) });
      const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
      return { status: res.status, json };
    } catch (e) { if (attempt === 3) throw e; await new Promise((r) => setTimeout(r, 8000)); }
  }
};
const approve = (recordTable, recordId, fieldName, translations) => call("POST", "/api/erp/translations/management", { review: true, recordTable, recordId, fieldName, translations });
const q = encodeURIComponent;

// ── 1. create + approve ────────────────────────────────────────────────────────────────────────────────────
for (const e of ENTITIES) {
  const savedName = spelling(e, e.saved);
  const c = await call("POST", "/api/erp/customers", { countryId: PK, countryBranchId: PK_MAIN, cityBranchId: QUETTA, customerName: savedName, address: "Test Road", originalLanguage: e.saved, contacts: [{ type: "Mobile", value: "+92 300 5550000" }] }, e.saved);
  e.customerId = (c.json?.data ?? c.json)?.customerId;
  const a = await call("POST", "/api/erp/accounting/accounts", { scope: "city_branch", countryId: PK, countryBranchId: PK_MAIN, cityBranchId: QUETTA, operationalDomain: "business", code: "AUTO", name: savedName, kind: "asset", currency: "PKR", openingBalance: 0, contacts: [{ type: "Mobile", value: "+923005550000" }] }, e.saved);
  e.accountId = (a.json?.data ?? a.json)?.accountId ?? (a.json?.data ?? a.json)?.id;
  check("create", `[create] ${e.saved}: customer + account saved in ${e.saved}`, c.status < 300 && a.status < 300 && e.customerId && e.accountId, `customer ${c.status} account ${a.status}`);
}
await new Promise((r) => setTimeout(r, 4000)); // the translation enrolment runs right after the save
for (const e of ENTITIES) {
  const others = Object.fromEntries(LANGS.filter((l) => l !== e.saved).map((l) => [l, spelling(e, l)]));
  const cr = await approve("customers", e.customerId, "customer_name", others);
  const ar = await approve("enterprise_accounts", e.accountId, "name", others);
  check("approve", `[approve] ${e.saved}: spelling approved in the other four languages`, cr.status < 300 && ar.status < 300, `customer ${cr.status} account ${ar.status} ${JSON.stringify(cr.json ?? {}).slice(0, 100)}`);
}

// ── 2. DISPLAY: 5 saved-in × 5 viewed-in ───────────────────────────────────────────────────────────────────
for (const e of ENTITIES) {
  for (const lang of LANGS) {
    const want = spelling(e, lang); // the viewer's-language spelling (== the saved text when lang is the saved-in language)
    const acc = await call("GET", `/api/erp/accounting/accounts/${e.accountId}?lang=${lang}`, undefined, lang);
    check("display", `[display] account saved ${e.saved} → viewed ${lang}: account API`, acc.json?.data?.account?.name === want, `got "${acc.json?.data?.account?.name}"`);
    const cus = await call("GET", `/api/erp/customers/${e.customerId}?lang=${lang}`, undefined, lang);
    const cn = (cus.json?.data?.customer ?? cus.json?.customer ?? cus.json?.data)?.customer_name;
    check("display", `[display] customer saved ${e.saved} → viewed ${lang}: customer API`, cn === want, `got "${cn}"`);
    const rep = await call("GET", `/api/erp/accounting/reports/accounts/general?lang=${lang}&q=${q(spelling(e, e.saved))}&limit=50`, undefined, lang);
    const row = (rep.json?.data?.rows ?? []).find((r) => r.accountId === e.accountId);
    check("display", `[display] account saved ${e.saved} → viewed ${lang}: Accounts General Report`, row?.accountName === want, `got "${row?.accountName}"`);
    const dir = await call("GET", `/api/erp/parties/directory?lang=${lang}&q=${q(spelling(e, e.saved))}&limit=50`, undefined, lang);
    const prow = (dir.json?.data?.parties ?? dir.json?.parties ?? []).find((p) => p.customerId === e.customerId);
    const shown = prow?.customerDisplayName ?? prow?.customerName;
    check("display", `[display] customer saved ${e.saved} → viewed ${lang}: Party Directory`, shown === want, `got "${shown}"`);
  }
}

// ── 3. SEARCH: type the name in language X, viewed in language X ──────────────────────────────────────────
for (const e of ENTITIES) {
  for (const lang of LANGS) {
    const term = spelling(e, lang);
    const rep = await call("GET", `/api/erp/accounting/reports/accounts/general?lang=${lang}&q=${q(term)}&limit=50`, undefined, lang);
    check("search", `[search] account saved ${e.saved}, typed ${lang}: Accounts General Report`, (rep.json?.data?.rows ?? []).some((r) => r.accountId === e.accountId), `status ${rep.status}`);
    const led = await call("GET", `/api/erp/accounting/reports/ledger/ledgers?lang=${lang}&q=${q(term)}&limit=200`, undefined, lang);
    check("search", `[search] account saved ${e.saved}, typed ${lang}: Ledger list`, (led.json?.data?.ledgers ?? []).some((r) => r.accountId === e.accountId), `status ${led.status}`);
    const dir = await call("GET", `/api/erp/parties/directory?lang=${lang}&q=${q(term)}&limit=50`, undefined, lang);
    check("search", `[search] customer saved ${e.saved}, typed ${lang}: Party Directory`, (dir.json?.data?.parties ?? dir.json?.parties ?? []).some((p) => p.customerId === e.customerId), `status ${dir.status}`);
    const gs = await call("GET", `/api/erp/search?q=${q(term)}&limit=20`, undefined, lang);
    const ids = (gs.json?.data?.results ?? []).map((r) => r.entityId);
    check("search", `[search] account saved ${e.saved}, typed ${lang}: Global search (account)`, ids.includes(e.accountId), `status ${gs.status}`);
    check("search", `[search] customer saved ${e.saved}, typed ${lang}: Global search (customer)`, ids.includes(e.customerId), `status ${gs.status}`);
    const cl = await call("GET", `/api/erp/customers?lang=${lang}&q=${q(term)}&limit=50`, undefined, lang);
    const cids = (cl.json?.data?.customers ?? cl.json?.data?.items ?? cl.json?.data ?? cl.json?.customers ?? []);
    check("search", `[search] customer saved ${e.saved}, typed ${lang}: Customer list`, Array.isArray(cids) && cids.some((c) => (c.id ?? c.customerId) === e.customerId), `status ${cl.status}`);
  }
}

// ── 4. CROSS-TYPED SEARCH: the screen is in the language the record was SAVED in, the name is typed in each of the five ───────
// (the diagonal is the plain case; the 20 off-diagonal cells are the ones a displayed-text-only search cannot find)
for (const e of ENTITIES) {
  for (const lang of LANGS) {
    const term = spelling(e, lang);
    const rep = await call("GET", `/api/erp/accounting/reports/accounts/general?lang=${e.saved}&q=${q(term)}&limit=50`, undefined, e.saved);
    check("xsearch", `[xsearch] account saved ${e.saved}, screen ${e.saved}, typed ${lang}: Accounts General Report`, (rep.json?.data?.rows ?? []).some((r) => r.accountId === e.accountId), `status ${rep.status}`);
    const led = await call("GET", `/api/erp/accounting/reports/ledger/ledgers?lang=${e.saved}&q=${q(term)}&limit=200`, undefined, e.saved);
    check("xsearch", `[xsearch] account saved ${e.saved}, screen ${e.saved}, typed ${lang}: Ledger list`, (led.json?.data?.ledgers ?? []).some((r) => r.accountId === e.accountId), `status ${led.status}`);
    const dir = await call("GET", `/api/erp/parties/directory?lang=${e.saved}&q=${q(term)}&limit=50`, undefined, e.saved);
    check("xsearch", `[xsearch] customer saved ${e.saved}, screen ${e.saved}, typed ${lang}: Party Directory`, (dir.json?.data?.parties ?? dir.json?.parties ?? []).some((p) => p.customerId === e.customerId), `status ${dir.status}`);
  }
}

// ── cleanup (archive through the app) ──────────────────────────────────────────────────────────────────────
for (const e of ENTITIES) {
  if (e.accountId) await call("DELETE", `/api/erp/accounting/accounts/${e.accountId}`);
  if (e.customerId) await call("DELETE", `/api/erp/customers/${e.customerId}`);
}

const pass = results.filter((r) => r.ok).length;
const byGroup = {};
for (const r of results) { const g = (byGroup[r.group] ??= { pass: 0, fail: 0 }); r.ok ? g.pass++ : g.fail++; }
fs.writeFileSync(`${OUT}/cross-language-search.json`, JSON.stringify({ base: BASE, run: RUN, pass, fail: results.length - pass, byGroup, results }, null, 2));
console.log(`\n${pass} PASS / ${results.length - pass} FAIL`, JSON.stringify(byGroup));
process.exit(results.length - pass ? 1 : 0);
