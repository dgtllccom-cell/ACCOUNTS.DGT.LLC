/**
 * DEV only — one expense-accounting framework, end to end, through the real HTTP APIs and the real database.
 *   BASE=http://localhost:3521 node scripts/dev/expense-framework-e2e.mjs
 *
 * Covers (owner's acceptance list):
 *   A  base currency + tax codes come from configuration, per branch / country
 *   B  mixed-currency rows with a DIFFERENT exchange rate per row, tax exclusive / inclusive / exempt, grand total in BASE currency
 *   C  the server refuses wrong figures, unknown tax codes, a code with the wrong rate, a missing rate, a tax code of another country
 *   D  role visibility: Business staff / Shipping staff / Branch Admin (both) / Country Admin (both) / Super Admin, section filter
 *   E  ledger posting: DR = CR = bill total in BASE currency at rate 1 (no second conversion), exactly once, 6-way race
 *   F  edit after posting is refused; the other country's branch is out of scope
 * Test records are created in the DEV database only (checked by the shared DEV guard) and soft-deleted again at the end.
 */
import { BASE, devSession, client, check, summary, race } from "./expense-framework-lib.mjs";
import { devQuery } from "./_rbac-users.mjs";

const UAE = { country: "935dd0b9-8228-43b3-b53d-c06e9ae2882f", main: "87c2e253-b6c1-482d-a808-272337f3ffda", deira: "b5e94645-05c1-4420-8ecb-141ca7d84f12", alRas: "301ee7c7-c0c6-401d-a4ee-f140462758f0" };
const PAK = { country: "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", main: "5269c1cb-92a1-4aa8-aad8-d4c7260badaa", quetta: "7d7d42fe-ddd1-4bec-8703-3911ad14fa8b" };
const UAE_TAX = "QA Sales Tax 5% (Updated QA)";
const PAK_TAX = "E2E-GST-18";
// two AED ledgers of the Deira Dubai city branch (a branch bill posts to branch-scope ledgers)
const LEDGER_DR = "19ef4b81-b669-47e7-91c2-c591762e6a98";
const LEDGER_CR = "a90d86f1-988c-4cda-8441-c479633b7902";
const today = new Date().toISOString().slice(0, 10);
const RUN = Date.now().toString(36).toUpperCase();
const created = { bills: [] };

const row = (rowSerial, p) => ({
  rowSerial, details: p.details ?? `E2E row ${rowSerial}`, qty: p.qty ?? 0, unitPrice: p.unitPrice ?? 0, amount: p.amount, currency: p.currency,
  operation: p.operation ?? "*", exchangeRate: p.exchangeRate ?? 0, finalAmount: p.finalAmount, taxOn: p.taxOn ?? false, taxPct: p.taxPct ?? 0,
  taxAmt: p.taxAmt ?? 0, grandAmount: p.grandAmount, taxMode: p.taxMode, taxCode: p.taxCode
});
const bill = (branch, title, entries, extra = {}) => ({
  header: { billSerial: "AUTO", branch, billDate: today, billMode: "credit", billTitle: title, referenceNo: `E2E-${RUN}`, ...extra }, entries
});

const sa = client(await devSession("super_admin"));

// ── test fixtures in the DEV database: a tax code that exists ONLY for Pakistan (removed again at the end)
await devQuery((sql) => sql`delete from public.country_tax_settings where tax_code = ${PAK_TAX}`);
await devQuery((sql) => sql`insert into public.country_tax_settings (country_id, tax_name, tax_code, tax_rate, applies_to, is_default, is_active)
                            values (${PAK.country}::uuid, 'E2E General Sales Tax', ${PAK_TAX}, 18, 'expense', false, true)`);

// posting needs today's approved daily rate for the country: add a DEV-only one when none exists (removed again at the end)
const RATE_TAG = "[E2E expense-framework] test rate";
const hadRate = (await devQuery((sql) => sql`select 1 from public.get_daily_rate(${UAE.country}::uuid, null, ${today}::date) limit 1`).catch(() => [])).length > 0;
if (!hadRate) {
  await devQuery((sql) => sql`insert into public.daily_usd_rates (country_id, rate_date, buying_rate, selling_rate, credit_rate, debit_rate, user_name, branch_name, rate_time, effective_from, currency_code)
    values (${UAE.country}::uuid, ${today}::date, 3.6725, 3.673, 3.673, 3.6725, ${RATE_TAG}, 'Country-wide (All Branches)', '00:01', now() - interval '2 hours', 'AED')`);
}

// ───────────────────────── A. configuration ─────────────────────────
{
  const uae = await sa("GET", `/api/erp/expenses/branch-context?branchId=${UAE.deira}`);
  check("A1 UAE branch → base currency AED read from configuration", uae.status === 200 && uae.json.data?.baseCurrency === "AED", JSON.stringify(uae.json).slice(0, 160));
  check("A2 UAE tax options come from the UAE tax list (5%)", (uae.json.data?.taxOptions || []).some((o) => o.code === UAE_TAX && o.rate === 5));
  check("A3 UAE does not offer Pakistan's tax code", !(uae.json.data?.taxOptions || []).some((o) => o.code === PAK_TAX));
  const pak = await sa("GET", `/api/erp/expenses/branch-context?branchId=${PAK.quetta}`);
  check("A4 Pakistan branch → base currency PKR", pak.status === 200 && pak.json.data?.baseCurrency === "PKR", JSON.stringify(pak.json).slice(0, 160));
  check("A5 Pakistan offers its own tax code at 18%", (pak.json.data?.taxOptions || []).some((o) => o.code === PAK_TAX && o.rate === 18));
  const bad = await sa("GET", `/api/erp/expenses/branch-context?branchId=not-a-uuid`);
  check("A6 invalid branch id → 400", bad.status === 400);
}

// ───────────────────────── B. mixed currency, per-row rates, tax modes ─────────────────────────
// Expected figures are worked out by hand here (independent of the production calculator):
//   r1  USD 100  × 3.6725 = 367.25 AED                       exempt        → 367.25
//   r2  PKR 10,000 ÷ 76   = 131.5789 → 131.58 AED            exclusive 5%  → tax 6.58 (131.58×5% = 6.579)   → 138.16
//   r3  AED 2 × 250 = 500 (same currency, no rate)           inclusive 5%  → base 476.19, tax 23.81          → 500.00
//   r4  EUR 50   × 4.0000 = 200.00 AED                       exempt        → 200.00
//   total = 367.25 + 138.16 + 500.00 + 200.00 = 1,205.41 AED
const mixedRows = [
  row(1, { amount: 100, currency: "USD", operation: "*", exchangeRate: 3.6725, finalAmount: 367.25, grandAmount: 367.25, taxOn: false }),
  row(2, { amount: 10000, currency: "PKR", operation: "/", exchangeRate: 76, finalAmount: 131.58, taxOn: true, taxPct: 5, taxAmt: 6.58, grandAmount: 138.16, taxMode: "exclusive", taxCode: UAE_TAX }),
  row(3, { qty: 2, unitPrice: 250, amount: 500, currency: "AED", exchangeRate: 0, finalAmount: 500, taxOn: true, taxPct: 5, taxAmt: 23.81, grandAmount: 500, taxMode: "inclusive", taxCode: UAE_TAX }),
  row(4, { amount: 50, currency: "EUR", operation: "*", exchangeRate: 4, finalAmount: 200, grandAmount: 200, taxOn: false })
];
let mixedBillId = null;
{
  const res = await sa("POST", "/api/erp/expenses", bill(UAE.deira, "daily_expenses", mixedRows));
  mixedBillId = res.json.billId;
  if (mixedBillId) created.bills.push(mixedBillId);
  check("B1 mixed-currency bill saved (HTTP 200)", res.status === 200 && res.json.success, JSON.stringify(res.json).slice(0, 300));
  check("B2 bill total in BASE currency = 1,205.41 AED", res.json.total === 1205.41 && res.json.baseCurrency === "AED", `${res.json.total} ${res.json.baseCurrency}`);
  const [lines, header] = await devQuery(async (sql) => [
    await sql`select row_serial, currency, amount, operation, exchange_rate, final_amount, tax_mode, tax_code, tax_pct, tax_amt, tax_base, grand_amount from public.expenses_bill_lines where bill_id = ${mixedBillId}::uuid order by row_serial`,
    (await sql`select base_currency, branch_id from public.expenses_bills where id = ${mixedBillId}::uuid`)[0]
  ]);
  check("B3 the bill remembers the BASE currency it was converted into", header?.base_currency === "AED");
  const n = (v) => Number(v);
  check("B4 each row keeps ITS OWN rate (3.6725 / 76 / none / 4)", n(lines[0]?.exchange_rate) === 3.6725 && n(lines[1]?.exchange_rate) === 76 && n(lines[2]?.exchange_rate) === 0 && n(lines[3]?.exchange_rate) === 4, lines.map((l) => l.exchange_rate).join(","));
  check("B5 original currency + original amount are preserved per row", lines.map((l) => `${l.currency}:${n(l.amount)}`).join(",") === "USD:100,PKR:10000,AED:500,EUR:50", lines.map((l) => `${l.currency}:${l.amount}`).join(","));
  check("B6 operation preserved (÷ on the PKR row)", lines[1]?.operation === "/" && lines[0]?.operation === "*");
  check("B7 converted amounts 367.25 / 131.58 / 500 / 200", [367.25, 131.58, 500, 200].every((v, i) => n(lines[i]?.final_amount) === v), lines.map((l) => l.final_amount).join(","));
  check("B8 tax exclusive 5% → 6.58 on 131.58", lines[1]?.tax_mode === "exclusive" && n(lines[1]?.tax_amt) === 6.58 && n(lines[1]?.grand_amount) === 138.16);
  check("B9 tax inclusive 5% → 23.81 inside 500 (base 476.19, grand stays 500)", lines[2]?.tax_mode === "inclusive" && n(lines[2]?.tax_amt) === 23.81 && n(lines[2]?.tax_base) === 476.19 && n(lines[2]?.grand_amount) === 500);
  check("B10 exempt rows carry no tax", lines[0]?.tax_mode === "exempt" && n(lines[0]?.tax_amt) === 0 && lines[3]?.tax_mode === "exempt" && n(lines[3]?.tax_amt) === 0);
  check("B11 tax code stored on taxed rows only", lines[1]?.tax_code === UAE_TAX && lines[2]?.tax_code === UAE_TAX && !lines[0]?.tax_code);
  check("B12 sum of row grand amounts = bill total (no rounding drift)", Math.round(lines.reduce((s, l) => s + n(l.grand_amount), 0) * 100) / 100 === 1205.41);

  // Pakistan: base PKR, 18% from ITS tax list
  const pk = await sa("POST", "/api/erp/expenses", bill(PAK.quetta, "daily_expenses", [
    row(1, { amount: 1000, currency: "PKR", finalAmount: 1000, taxOn: true, taxPct: 18, taxAmt: 180, grandAmount: 1180, taxMode: "exclusive", taxCode: PAK_TAX }),
    row(2, { amount: 10, currency: "USD", operation: "*", exchangeRate: 280, finalAmount: 2800, grandAmount: 2800, taxOn: false })
  ]));
  if (pk.json.billId) created.bills.push(pk.json.billId);
  check("B13 Pakistan bill: PKR base, 18% tax from the Pakistan list, total 3,980 PKR", pk.status === 200 && pk.json.baseCurrency === "PKR" && pk.json.total === 3980, JSON.stringify(pk.json).slice(0, 240));
}

// ───────────────────────── C. the server is the authority ─────────────────────────
{
  const post = (rows, branch = UAE.deira) => sa("POST", "/api/erp/expenses", bill(branch, "daily_expenses", rows));
  const r1 = await post([row(1, { amount: 100, currency: "USD", exchangeRate: 3.6725, finalAmount: 999, grandAmount: 999 })]);
  check("C1 tampered converted amount → 422 AMOUNT_MISMATCH", r1.status === 422 && r1.json.code === "AMOUNT_MISMATCH", JSON.stringify(r1.json).slice(0, 200));
  const r2 = await post([row(1, { amount: 100, currency: "AED", finalAmount: 100, taxOn: true, taxPct: 5, taxAmt: 5, grandAmount: 105, taxMode: "exclusive", taxCode: "NO-SUCH-CODE" })]);
  check("C2 unknown tax code → 422 TAX_CODE_UNKNOWN", r2.status === 422 && r2.json.code === "TAX_CODE_UNKNOWN", JSON.stringify(r2.json).slice(0, 200));
  const r3 = await post([row(1, { amount: 100, currency: "AED", finalAmount: 100, taxOn: true, taxPct: 18, taxAmt: 18, grandAmount: 118, taxMode: "exclusive", taxCode: UAE_TAX })]);
  check("C3 configured code with the wrong rate (18% instead of 5%) → 422 TAX_RATE_MISMATCH", r3.status === 422 && r3.json.code === "TAX_RATE_MISMATCH", JSON.stringify(r3.json).slice(0, 200));
  const r4 = await post([row(1, { amount: 100, currency: "USD", exchangeRate: 0, finalAmount: 100, grandAmount: 100 })]);
  check("C4 foreign currency without a rate → 422 NO_RATE", r4.status === 422 && r4.json.code === "NO_RATE", JSON.stringify(r4.json).slice(0, 200));
  const r5 = await post([row(1, { amount: 100, currency: "AED", finalAmount: 100, taxOn: true, taxPct: 18, taxAmt: 18, grandAmount: 118, taxMode: "exclusive", taxCode: PAK_TAX })]);
  check("C5 Pakistan's tax code on a UAE branch → refused (jurisdiction)", r5.status === 422 && ["TAX_CODE_UNKNOWN", "TAX_RATE_MISMATCH"].includes(r5.json.code), JSON.stringify(r5.json).slice(0, 200));
  const r6 = await post([row(1, { amount: 100, currency: "PKR", finalAmount: 100, taxOn: true, taxPct: 5, taxAmt: 5, grandAmount: 105, taxMode: "exclusive", taxCode: UAE_TAX })], PAK.quetta);
  check("C6 UAE's tax code on a Pakistan branch → refused (jurisdiction)", r6.status === 422, JSON.stringify(r6.json).slice(0, 200));
  const r7 = await post([row(1, { amount: 0.001, currency: "AED", finalAmount: 0, grandAmount: 0 })]);
  check("C7 zero total → refused", r7.status >= 400 && r7.status < 500, JSON.stringify(r7.json).slice(0, 200));
}

// ───────────────────────── D. role visibility ─────────────────────────
const whoAmI = { business: {}, shipping: {} };
{
  const mk = async (label, role, extra) => ({ label, api: client(await devSession(role, extra)) });
  const sessions = {
    bizStaff: await mk("Business staff", "accountant", { countryId: UAE.country, countryBranchId: UAE.main, cityBranchId: UAE.deira, operationalDomain: "business" }),
    shipStaff: await mk("Shipping staff", "accountant", { countryId: UAE.country, countryBranchId: UAE.main, cityBranchId: UAE.alRas, operationalDomain: "shipping" }),
    branchBoth: await mk("Branch Admin (both)", "city_branch_admin", { countryId: UAE.country, countryBranchId: UAE.main, cityBranchId: UAE.deira, operationalDomain: "both" }),
    countryBoth: await mk("Country Admin (both)", "country_admin", { countryId: UAE.country, operationalDomain: "both" }),
    sa: { label: "Super Admin", api: sa }
  };
  // two UAE bills: one Business (Deira), one Shipping (Al Ras); one Pakistan Business bill (out of UAE scope)
  const bBiz = await sa("POST", "/api/erp/expenses", bill(UAE.deira, "daily_expenses", [row(1, { amount: 100, currency: "AED", finalAmount: 100, grandAmount: 100 })]));
  const bShip = await sa("POST", "/api/erp/expenses", bill(UAE.alRas, "customer_expenses", [row(1, { amount: 200, currency: "AED", finalAmount: 200, grandAmount: 200 })]));
  const bPak = await sa("POST", "/api/erp/expenses", bill(PAK.quetta, "daily_expenses", [row(1, { amount: 300, currency: "PKR", finalAmount: 300, grandAmount: 300 })]));
  for (const x of [bBiz, bShip, bPak]) if (x.json.billId) created.bills.push(x.json.billId);
  const ids = { biz: bBiz.json.billId, ship: bShip.json.billId, pak: bPak.json.billId };
  check("D0 fixtures created (Business UAE, Shipping UAE, Business PK)", !!(ids.biz && ids.ship && ids.pak), JSON.stringify([bBiz.status, bShip.status, bPak.status]));

  const visible = async (s, qs = "") => {
    const r = await s.api("GET", `/api/erp/expenses?limit=1000${qs}`);
    const set = new Set((r.json.bills || []).map((b) => b.id));
    return { status: r.status, has: (id) => set.has(id), n: set.size, section: r.json.section };
  };

  const biz = await visible(sessions.bizStaff);
  check("D1 Business staff sees the Business bill only", biz.status === 200 && biz.has(ids.biz) && !biz.has(ids.ship) && !biz.has(ids.pak), `status ${biz.status} n=${biz.n}`);
  const bizAsk = await visible(sessions.bizStaff, "&section=shipping");
  check("D2 Business staff cannot widen to Shipping with ?section=shipping", bizAsk.status === 200 && !bizAsk.has(ids.ship) && bizAsk.section === "business", `section=${bizAsk.section}`);

  const shp = await visible(sessions.shipStaff);
  check("D3 Shipping staff sees the Shipping bill only", shp.status === 200 && shp.has(ids.ship) && !shp.has(ids.biz) && !shp.has(ids.pak), `status ${shp.status} n=${shp.n}`);
  const shpAsk = await visible(sessions.shipStaff, "&section=business");
  check("D4 Shipping staff cannot widen to Business with ?section=business", shpAsk.status === 200 && !shpAsk.has(ids.biz) && shpAsk.section === "shipping", `section=${shpAsk.section}`);

  const bb = await visible(sessions.branchBoth);
  check("D5 Branch Admin (both) sees its own branch's Business bill, not another branch's Shipping bill", bb.status === 200 && bb.has(ids.biz) && !bb.has(ids.pak), `status ${bb.status}`);
  const cb = await visible(sessions.countryBoth);
  check("D6 Country Admin (both) sees every UAE branch (Business + Shipping) but not Pakistan", cb.status === 200 && cb.has(ids.biz) && cb.has(ids.ship) && !cb.has(ids.pak), `status ${cb.status}`);
  const cbBiz = await visible(sessions.countryBoth, "&section=business");
  const cbShp = await visible(sessions.countryBoth, "&section=shipping");
  check("D7 Country Admin filter: Business → only Business, Shipping → only Shipping", cbBiz.has(ids.biz) && !cbBiz.has(ids.ship) && cbShp.has(ids.ship) && !cbShp.has(ids.biz));
  const all = await visible(sessions.sa);
  check("D8 Super Admin sees all three", all.has(ids.biz) && all.has(ids.ship) && all.has(ids.pak));
  const saShp = await visible(sessions.sa, "&section=shipping");
  check("D9 Super Admin filter 'Shipping Line' excludes Business", saShp.has(ids.ship) && !saShp.has(ids.biz) && !saShp.has(ids.pak));

  const mkBill = (branch, title) => bill(branch, title, [row(1, { amount: 10, currency: "AED", finalAmount: 10, grandAmount: 10 })]);
  const c1 = await sessions.bizStaff.api("POST", "/api/erp/expenses", mkBill(UAE.deira, "customer_expenses"));
  check("D10 Business staff cannot create a Shipping bill → 403", c1.status === 403, `${c1.status} ${c1.json.code || c1.json.error?.code || ""}`);
  const c2 = await sessions.shipStaff.api("POST", "/api/erp/expenses", mkBill(UAE.alRas, "daily_expenses"));
  check("D11 Shipping staff cannot create a Business bill → 403", c2.status === 403, `${c2.status} ${c2.json.code || ""}`);
  const c3 = await sessions.countryBoth.api("POST", "/api/erp/expenses", mkBill(PAK.quetta, "daily_expenses"));
  check("D12 UAE Country Admin cannot save into a Pakistan branch → 403", c3.status === 403, `${c3.status}`);
  const t1 = await sessions.bizStaff.api("POST", "/api/erp/expenses/transfer", { billId: ids.ship, debitLedgerId: LEDGER_DR, creditLedgerId: LEDGER_CR });
  check("D13 Business staff cannot transfer (post) a Shipping bill", t1.status === 403 || t1.status === 404, `${t1.status} ${t1.json.code || ""}`);
  Object.assign(whoAmI, { sessions, ids });
}

// ───────────────────────── E. ledger posting ─────────────────────────
{
  const bal = async () => (await devQuery((sql) => sql`select id, debit_total, credit_total from public.ledgers where id in (${LEDGER_DR}::uuid, ${LEDGER_CR}::uuid)`))
    .reduce((m, r) => ({ ...m, [r.id]: { d: Number(r.debit_total || 0), c: Number(r.credit_total || 0) } }), {});
  const before = await bal();
  const t = await sa("POST", "/api/erp/expenses/transfer", { billId: mixedBillId, debitLedgerId: LEDGER_DR, creditLedgerId: LEDGER_CR });
  check("E1 mixed-currency bill posts to the books", t.status === 200 && t.json.success && t.json.entryId, JSON.stringify(t.json).slice(0, 200));
  const after = await bal();
  const dDr = Math.round((after[LEDGER_DR].d - before[LEDGER_DR].d) * 100) / 100;
  const dCr = Math.round((after[LEDGER_CR].c - before[LEDGER_CR].c) * 100) / 100;
  check("E2 expense ledger debited 1,205.41 AED (the BASE total — not ×3.6725, not ×76)", dDr === 1205.41, `Δdebit=${dDr}`);
  check("E3 counter ledger credited 1,205.41 AED", dCr === 1205.41, `Δcredit=${dCr}`);
  if (!t.json.entryId) { check("E4-E10 skipped: the first transfer did not post", false); throw new Error("first transfer failed — see E1"); }
  const lines = await devQuery((sql) => sql`select debit, credit, currency, usd_rate from public.roznamcha_lines where roznamcha_entry_id = ${t.json.entryId}::uuid order by debit desc`);
  check("E4 the entry has exactly 2 lines, in AED at rate 1, DR = CR", lines.length === 2 && lines.every((l) => l.currency === "AED") && Number(lines[0].debit) === 1205.41 && Number(lines[1].credit) === 1205.41, JSON.stringify(lines));
  const [bl] = await devQuery((sql) => sql`select transferred_to_roznamcha, roznamcha_entry_id from public.expenses_bills where id = ${mixedBillId}::uuid`);
  check("E5 the bill is flagged transferred with that entry id", bl.transferred_to_roznamcha === true && bl.roznamcha_entry_id === t.json.entryId);
  const t2 = await sa("POST", "/api/erp/expenses/transfer", { billId: mixedBillId, debitLedgerId: LEDGER_DR, creditLedgerId: LEDGER_CR });
  check("E6 a second transfer is refused (409), nothing is posted twice", t2.status === 409, `${t2.status} ${t2.json.code || ""}`);
  const [cnt] = await devQuery((sql) => sql`select count(*)::int n from public.roznamcha_entries where source_module='expenses_bills' and source_transaction_id = ${mixedBillId}::uuid and deleted_at is null`);
  check("E7 exactly ONE ledger entry exists for the bill", cnt.n === 1, `n=${cnt.n}`);
  const ed = await sa("POST", "/api/erp/expenses", { ...bill(UAE.deira, "daily_expenses", mixedRows), header: { ...bill(UAE.deira, "daily_expenses", mixedRows).header, id: mixedBillId, billSerial: "KEEP" } });
  check("E8 a posted bill can no longer be edited (409)", ed.status === 409, `${ed.status} ${ed.json.code || ""}`);

  // race: six simultaneous transfers of one fresh bill → exactly one wins
  const rb = await sa("POST", "/api/erp/expenses", bill(UAE.deira, "daily_expenses", [row(1, { amount: 321.5, currency: "AED", finalAmount: 321.5, grandAmount: 321.5 })]));
  created.bills.push(rb.json.billId);
  const b0 = await bal();
  const results = await race(6, () => sa("POST", "/api/erp/expenses/transfer", { billId: rb.json.billId, debitLedgerId: LEDGER_DR, creditLedgerId: LEDGER_CR }));
  const wins = results.filter((r) => r.status === 200).length;
  const b1 = await bal();
  const [cn2] = await devQuery((sql) => sql`select count(*)::int n from public.roznamcha_entries where source_module='expenses_bills' and source_transaction_id = ${rb.json.billId}::uuid and deleted_at is null`);
  check("E9 6-way race: exactly one transfer succeeds", wins === 1, results.map((r) => r.status).join(","));
  check("E10 race: one ledger entry, ledger moved by the amount ONCE (321.50)", cn2.n === 1 && Math.round((b1[LEDGER_DR].d - b0[LEDGER_DR].d) * 100) / 100 === 321.5, `entries=${cn2.n} Δ=${b1[LEDGER_DR].d - b0[LEDGER_DR].d}`);
}

// ───────────────────────── cleanup ─────────────────────────
await devQuery(async (sql) => {
  await sql`delete from public.country_tax_settings where tax_code = ${PAK_TAX}`;
  await sql`delete from public.daily_usd_rates where user_name = ${RATE_TAG}`;
  // test bills created by this run are soft-deleted; posted ones keep their ledger entries (audit trail) but are hidden from registers
  if (created.bills.length) await sql`update public.expenses_bills set deleted_at = now() where id = any(${created.bills}::uuid[]) and reference_no = ${"E2E-" + RUN}`;
});

const ok = summary("expense-framework-e2e");
process.exit(ok ? 0 : 1);
