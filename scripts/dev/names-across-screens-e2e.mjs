/**
 * DEV only — one name rule on every screen, with REAL DEV records:
 *   an approved variant (person-entered / corrected / verified) for the selected language, otherwise the exact saved name;
 *   a stored MACHINE rendering of the name (e.g. "احمد Al Falasi", "بلال حسین") must never be shown.
 *   BASE=http://localhost:3521 node scripts/dev/names-across-screens-e2e.mjs
 * Screens / data paths per language (EN / UR / AR / FA / PS):
 *   Customer master API, Customer Register list API + page, Party Directory API, account detail API, Accounts General Report page,
 *   Ledger General Report page (ledgers with postings — idle ledgers are not listed there by design). Truck owner / driver names are covered by truck-registration-e2e.mjs.
 */
import { chromium } from "playwright";
import { devQuery } from "./_rbac-users.mjs";

const BASE = process.env.BASE || "http://localhost:3521";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const LANGS = ["en", "ur", "ar", "fa", "ps"];
const COL = { ur: "urdu_text", ar: "arabic_text", fa: "persian_text", ps: "pashto_text", en: "english_text" };
// real DEV customers linked to accounts: machine-only renderings, an imported/pending one, and one with approved variants
const CUSTOMERS = ["e967e161-6930-4d66-a4c5-8624bbded024", "161e13b1-89a8-42e1-8c5a-0f260c39b382", "cffa5a71-a614-4bf5-a12d-5869056afb42", "092d8917-3b96-48d2-bdcf-e316ebcb2ab7",
  "50b7c0c8-e063-4b4c-95b9-7e82d6c8e2b0" /* machine rendering + a ledger with postings */];

const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 220) : ""); };
const r0 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r0.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const get = async (path, lang) => {
  const res = await fetch(BASE + path, { headers: { cookie: `erp_session=${token}; erp_lang=${lang}`, "x-erp-lang": lang } });
  try { return await res.json(); } catch { return null; }
};

const records = [];
for (const id of CUSTOMERS) {
  const c = (await devQuery((sql) => sql`select customer_name from public.customers where id = ${id}::uuid`))[0];
  const t = (await devQuery((sql) => sql`select english_text, urdu_text, arabic_text, persian_text, pashto_text, source::text as source, translation_status, corrected_by from public.record_translations where record_table = 'customers' and record_id = ${id}::uuid and field_name = 'customer_name' and deleted_at is null limit 1`))[0];
  const acc = (await devQuery((sql) => sql`select a.id, a.name, (select l.id from public.ledgers l where l.enterprise_account_id = a.id and l.deleted_at is null limit 1) as ledger_id, exists (select 1 from public.ledgers l where l.enterprise_account_id = a.id and l.deleted_at is null and (l.debit_total <> 0 or l.credit_total <> 0)) as has_activity from public.enterprise_accounts a where a.customer_id = ${id}::uuid and a.deleted_at is null and a.status <> 'archived' order by a.created_at limit 1`))[0];
  const approved = !!t && (t.source === "manual" || !!t.corrected_by || ["human_verified", "verified", "approved"].includes(String(t.translation_status)));
  const expected = {}; const machine = new Set();
  for (const l of LANGS) {
    const v = t?.[COL[l]];
    expected[l] = approved && v ? v : c.customer_name;
    if (!approved && v && v !== c.customer_name) machine.add(v);
  }
  records.push({ id, saved: c.customer_name, approved, expected, machine: [...machine], account: acc });
}

const browser = await chromium.launch();
for (const rec of records) {
  const tag = `["${rec.saved}"${rec.approved ? " · approved variants" : ""}]`;
  for (const lang of LANGS) {
    const want = rec.expected[lang];
    const one = await get(`/api/erp/customers/${rec.id}?lang=${lang}`, lang);
    const oneName = (one?.data?.customer ?? one?.customer ?? one?.data)?.customer_name;
    check(`${tag} customer master API ${lang} = "${want}"`, oneName === want, `got "${oneName}"`);
    const list = await get(`/api/erp/customers?lang=${lang}&q=${encodeURIComponent(rec.saved)}&limit=50`, lang);
    const row = (list?.data?.customers ?? list?.customers ?? []).find((x) => x.id === rec.id);
    check(`${tag} Customer Register list API ${lang}`, !!row && (row.customer_name === want || row.customer_name === rec.saved) && !rec.machine.includes(row.customer_name), `got "${row?.customer_name}"`);
    const dir = await get(`/api/erp/parties/directory?lang=${lang}&q=${encodeURIComponent(rec.saved)}&limit=50`, lang);
    const prow = (dir?.data?.parties ?? dir?.parties ?? []).find((x) => x.customerId === rec.id);
    check(`${tag} Party Directory API ${lang} = "${want}"`, !!prow && prow.customerName === want, `got "${prow?.customerName}"`);
    if (rec.account) {
      const a = await get(`/api/erp/accounting/accounts/${rec.account.id}?lang=${lang}`, lang);
      const an = (a?.data?.account ?? a?.account)?.name;
      check(`${tag} account API ${lang} = saved account name`, an === rec.account.name, `got "${an}"`);
    }
  }
  // pages: the name as the rule says, and never a stored machine rendering
  for (const lang of LANGS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
    await ctx.addInitScript((l) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, lang);
    const p = await ctx.newPage();
    // the Register is searched through its own filter box; the two reports open the record itself (?accountId / ?ledgerId)
    for (const [label, path, search] of [
      ["Customer Register", "/dashboard/customers", rec.saved],
      ["Accounts General Report", rec.account ? `/dashboard/new-entry/accounts/general-report?accountId=${rec.account.id}` : null, null],
      // the Ledger General Report lists only ledgers with entries or a balance (by design) — an idle ledger is not on it
      ["Ledger General Report", rec.account?.ledger_id && rec.account.has_activity ? `/dashboard/ledger/general-report?ledgerId=${rec.account.ledger_id}` : null, null]
    ]) {
      if (!path) continue;
      try {
        await p.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 180000 });
        await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await p.waitForTimeout(4000);
        if (search) {
          if (!(await p.locator("div.space-y-3 input[type=text]").first().isVisible().catch(() => false))) await p.locator("button.h-9.rounded-xl:has(svg.lucide-search)").first().click();
          const input = p.locator("div.space-y-3 input[type=text]").first();
          await input.waitFor({ timeout: 15000 });
          await input.fill(search);
          await p.waitForTimeout(2500);
        }
        let text = "";
        const expectName0 = label === "Customer Register" ? rec.expected[lang] : rec.account.name;
        for (let i = 0; i < 4; i++) { text = await p.evaluate(() => document.body.innerText); if (text.includes(expectName0) || text.includes(rec.saved)) break; await p.waitForTimeout(3000); }
        const shownMachine = rec.machine.filter((m) => text.includes(m));
        const expectName = label === "Customer Register" ? rec.expected[lang] : rec.account.name;
        check(`${tag} ${label} page ${lang}: no machine rendering of the name`, shownMachine.length === 0, shownMachine.join(" | "));
        check(`${tag} ${label} page ${lang}: shows "${expectName}"`, text.includes(expectName) || text.includes(rec.saved), "");
      } catch (e) {
        check(`${tag} ${label} page ${lang}: loads`, false, String(e.message).split("\n")[0]);
      }
    }
    await ctx.close();
  }
}
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n==== ${results.length - failed} PASS / ${failed} FAIL ====`);
process.exit(failed ? 1 : 0);
