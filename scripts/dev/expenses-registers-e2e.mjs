/**
 * DEV only — the four Expenses Registers (customer / truck / customs / other) are backed by real expense bills.
 *   BASE=http://localhost:3520 OUT=<dir> node scripts/dev/expenses-registers-e2e.mjs
 * Checks, per register:
 *   1. API: /api/erp/expenses?category=<bill_title> returns exactly the database's bills for that category (category separation).
 *   2. Page: rendered header count equals the database count; no demo figures ($124,580 / 89,230 / 21,450 / 13,900 / demo parties) appear.
 *   3. Page: EN and UR both render, with no page errors.
 * Empty-vs-populated: the database decides which case runs; an empty category must render zero totals.
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { devQuery } from "./_rbac-users.mjs";

const BASE = process.env.BASE || "http://localhost:3520";
if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".ui-out/expenses-registers";
fs.mkdirSync(OUT, { recursive: true });

const REGISTERS = [
  { key: "customer", billTitle: "customer_expenses", path: "/dashboard/clearing-agent/customer-expenses" },
  { key: "truck", billTitle: "truck_expenses", path: "/dashboard/clearing-agent/truck-expenses" },
  { key: "customs", billTitle: "customs_expenses", path: "/dashboard/clearing-agent/customs-expenses" },
  { key: "other", billTitle: "other_expenses", path: "/dashboard/clearing-agent/other-expenses" },
];
const DEMO_MARKERS = ["124,580", "89,230", "21,450", "13,900", "52,430", "46,590", "25,560", "38,120", "34,880", "16,230", "9,210", "7,280", "4,960", "14,310", "11,710", "9,330", "Al Noor Trading", "Faisal Enterprises", "Metro Cash & Carry"];

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok });
  console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 220) : "");
};

// database truth, per category (live bills only)
const dbCounts = await devQuery((sql) => sql`
  select bill_title, count(*)::int as n from public.expenses_bills
  where deleted_at is null and bill_title in ('customer_expenses','truck_expenses','customs_expenses','other_expenses')
  group by 1`);
const dbByTitle = Object.fromEntries(dbCounts.map((r) => [r.bill_title, r.n]));

const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const cookie = `erp_session=${token}`;

// 1. API category separation
for (const reg of REGISTERS) {
  const res = await fetch(`${BASE}/api/erp/expenses?category=${reg.billTitle}&limit=2000`, { headers: { cookie } });
  const body = await res.json().catch(() => ({}));
  const bills = Array.isArray(body.bills) ? body.bills : [];
  const wrongCat = bills.filter((b) => b.bill_title !== reg.billTitle).length;
  const expected = dbByTitle[reg.billTitle] || 0;
  check(`API ${reg.key}: returns the database's ${reg.billTitle} bills (${expected})`, res.ok && bills.length === expected && wrongCat === 0, `got ${bills.length}, wrong-category ${wrongCat}, HTTP ${res.status}`);
}

// 2 + 3. rendered registers, EN and UR
const b = await chromium.launch();
for (const lang of ["en", "ur"]) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
  await ctx.addInitScript(([l]) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, [lang]);
  for (const reg of REGISTERS) {
    const p = await ctx.newPage(); const errs = [];
    p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
    await p.goto(BASE + reg.path, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.waitForFunction(() => !document.querySelector(".animate-spin") && document.body.innerText.length > 200, null, { timeout: 90000 }).catch(() => {});
    await p.waitForTimeout(2500);
    const text = await p.evaluate(() => document.body.innerText);
    const expected = dbByTitle[reg.billTitle] || 0;
    const demo = DEMO_MARKERS.filter((m) => text.includes(m));
    check(`page ${reg.key} [${lang}]: no demo figures or parties`, demo.length === 0, demo.join(" | "));
    check(`page ${reg.key} [${lang}]: header count = database (${expected})`, text.includes(`(${expected})`), "");
    check(`page ${reg.key} [${lang}]: no page errors`, errs.length === 0, errs.join(" | "));
    if (expected === 0) {
      check(`page ${reg.key} [${lang}]: empty state shows zero totals`, /0\.00/.test(text) && !/\d{1,3}(,\d{3})+\.\d{2}/.test(text.replace(/\d{4}-\d{2}-\d{2}/g, "")), "");
    }
    await p.screenshot({ path: `${OUT}/${reg.key}-${lang}.png`, fullPage: false });
    await p.close();
  }
  await ctx.close();
}
await b.close();

const passed = results.filter((x) => x.ok).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
