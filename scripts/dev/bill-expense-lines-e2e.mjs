/**
 * DEV only — Bill Expenses (the expense lines added to purchase / sales / shipping / clearing bills), end to end.
 *   BASE=http://localhost:3521 node scripts/dev/bill-expense-lines-e2e.mjs
 *
 *   F  mixed-currency lines with a different rate each, tax exempt / exclusive / inclusive, base currency + tax list per country
 *   G  the server refuses a foreign line without a rate, an unknown / wrong-rate tax code, a taxed line without a code; edit recalculates
 *   H  Business vs Shipping visibility on the register and on adding / reading lines
 *   I  ledger posting: DR = CR = the line's BASE amount at rate 1, exactly once (5-way race), void reverses once, no total drift
 *   J  consolidated register / report: totals per currency (never one number across currencies), each line counted once
 *   K  Job Cost report: totals per currency, matches the database, mixed-currency orders show no single number
 */
import { BASE, devSession, client, check, summary, race } from "./expense-framework-lib.mjs";
import { devQuery } from "./_rbac-users.mjs";

const UAE = { country: "935dd0b9-8228-43b3-b53d-c06e9ae2882f", main: "87c2e253-b6c1-482d-a808-272337f3ffda", deira: "b5e94645-05c1-4420-8ecb-141ca7d84f12", alRas: "301ee7c7-c0c6-401d-a4ee-f140462758f0" };
const PAK = { country: "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", quetta: "7d7d42fe-ddd1-4bec-8703-3911ad14fa8b" };
const UAE_TAX = "QA Sales Tax 5% (Updated QA)";
// existing DEV register rows (Deira, AED): one Business (purchase booking), one Shipping (BL), plus a Quetta (PKR) shipping row
const BE_BIZ = "97c8420f-d675-48a3-86fd-aaf6f720ff46";
const BE_SHIP = "c0be1070-0d8d-4e5b-95ff-7d3ed8cf1089";
const BE_PAK_SHIP = "88832b99-d93f-43c8-96ce-cafd30ac4822";
const LEDGER_DR = "19ef4b81-b669-47e7-91c2-c591762e6a98";
const LEDGER_CR = "a90d86f1-988c-4cda-8441-c479633b7902";
const today = new Date().toISOString().slice(0, 10);
const RATE_TAG = "[E2E bill-expense-lines] test rate";
const made = []; // [billExpenseId, lineId]

const sa = client(await devSession("super_admin"));
const n2 = (v) => Math.round(Number(v) * 100) / 100;

const hadRate = (await devQuery((sql) => sql`select 1 from public.get_daily_rate(${UAE.country}::uuid, null, ${today}::date) limit 1`).catch(() => [])).length > 0;
if (!hadRate) {
  await devQuery((sql) => sql`insert into public.daily_usd_rates (country_id, rate_date, buying_rate, selling_rate, credit_rate, debit_rate, user_name, branch_name, rate_time, effective_from, currency_code)
    values (${UAE.country}::uuid, ${today}::date, 3.6725, 3.673, 3.673, 3.6725, ${RATE_TAG}, 'Country-wide (All Branches)', '00:01', now() - interval '2 hours', 'AED')`);
}

const addLine = async (api, beId, body) => {
  const r = await api("POST", `/api/erp/bill-expenses/${beId}/lines`, body);
  const id = r.json?.data?.id ?? r.json?.id;
  if (id) made.push([beId, id]);
  return { ...r, id };
};
const lineRow = async (id) => (await devQuery((sql) => sql`select * from public.bill_expense_lines where id = ${id}::uuid`))[0];

// ───────────────────────── F. lines ─────────────────────────
let L1, L2, L3, L4;
{
  const det = await sa("GET", `/api/erp/bill-expenses/${BE_BIZ}`);
  check("F0 the register detail returns the BASE currency (AED) and the UAE tax list", det.status === 200 && det.json.data?.billExpense?.functionalCurrency === "AED" && (det.json.data?.billExpense?.taxOptions || []).some((o) => o.code === UAE_TAX), JSON.stringify(det.json.data?.billExpense?.taxOptions || det.json).slice(0, 200));

  // Hand-worked figures (independent of the production calculator): base currency AED
  //   L1  USD 100 × 3.6725            = 367.25                         exempt                → 367.25
  //   L2  PKR 10,000 × 0.01315        = 131.50     exclusive 5%        tax 6.575 → 6.58      → 138.08
  //   L3  AED 500 (same currency)     = 500.00     inclusive 5%        base 476.19, tax 23.81 → 500.00
  //   L4  EUR 50 × 4.0                = 200.00                         exempt                → 200.00
  L1 = await addLine(sa, BE_BIZ, { expenseType: "shipping", currency: "USD", amount: 100, exchangeRate: 3.6725, taxMode: "exempt", taxPct: 0, details: "E2E L1" });
  L2 = await addLine(sa, BE_BIZ, { expenseType: "clearing", currency: "PKR", amount: 10000, exchangeRate: 0.01315, taxMode: "exclusive", taxPct: 5, taxCode: UAE_TAX, details: "E2E L2" });
  L3 = await addLine(sa, BE_BIZ, { expenseType: "handling", currency: "AED", amount: 500, taxMode: "inclusive", taxPct: 5, taxCode: UAE_TAX, details: "E2E L3" });
  L4 = await addLine(sa, BE_BIZ, { expenseType: "other", currency: "EUR", amount: 50, exchangeRate: 4, taxMode: "exempt", taxPct: 0, details: "E2E L4" });
  check("F1 four lines saved (USD / PKR / AED / EUR)", [L1, L2, L3, L4].every((l) => l.status === 201 || l.status === 200), [L1, L2, L3, L4].map((l) => l.status).join(","));
  const [r1, r2, r3, r4] = await Promise.all([L1.id, L2.id, L3.id, L4.id].map(lineRow));
  check("F2 USD line: 100 × 3.6725 = 367.25 AED, exempt", n2(r1.local_amount) === 367.25 && n2(r1.grand_amount) === 367.25 && r1.tax_mode === "exempt" && n2(r1.tax_amount) === 0, `${r1.local_amount}/${r1.grand_amount}/${r1.tax_mode}`);
  check("F3 PKR line keeps ITS rate (0.01315) → 131.50 AED; tax exclusive 5% = 6.58; grand 138.08", n2(r2.local_amount) === 131.5 && Number(r2.exchange_rate) === 0.01315 && n2(r2.tax_amount) === 6.58 && n2(r2.grand_amount) === 138.08 && r2.tax_mode === "exclusive" && r2.tax_code === UAE_TAX, `${r2.local_amount}/${r2.exchange_rate}/${r2.tax_amount}/${r2.grand_amount}`);
  check("F4 AED line (the base currency): no conversion, tax inclusive 5% → 23.81 inside 500 (base 476.19)", n2(r3.local_amount) === 500 && Number(r3.exchange_rate) === 1 && n2(r3.tax_amount) === 23.81 && n2(r3.tax_base) === 476.19 && n2(r3.grand_amount) === 500 && r3.tax_mode === "inclusive", `${r3.local_amount}/${r3.tax_amount}/${r3.tax_base}/${r3.grand_amount}`);
  check("F5 EUR line: 50 × 4.0 = 200 AED", n2(r4.local_amount) === 200 && n2(r4.grand_amount) === 200);
  check("F6 original currency + original amount are preserved on every line", r1.currency === "USD" && n2(r1.amount) === 100 && r2.currency === "PKR" && n2(r2.amount) === 10000 && r3.currency === "AED" && r4.currency === "EUR" && n2(r4.amount) === 50);
  const sumGrand = n2([r1, r2, r3, r4].reduce((s, r) => s + Number(r.grand_amount), 0));
  check("F7 grand total of the four lines in AED = 1,205.33 (367.25 + 138.08 + 500 + 200)", sumGrand === 1205.33, `sum=${sumGrand}`);
  const det2 = await sa("GET", `/api/erp/bill-expenses/${BE_BIZ}`);
  const dl = (det2.json.data?.lines || []).find((l) => l.id === L2.id);
  check("F8 the detail API returns tax mode / code / tax amount for the line editor", dl?.taxMode === "exclusive" && dl?.taxCode === UAE_TAX && dl?.taxAmount === 6.58, JSON.stringify(dl).slice(0, 200));
}

// ───────────────────────── G. server authority ─────────────────────────
{
  const e1 = await addLine(sa, BE_BIZ, { expenseType: "other", currency: "USD", amount: 10, taxMode: "exempt", taxPct: 0 });
  check("G1 foreign currency without a rate → 422 NO_RATE", e1.status === 422 && (e1.json?.error?.code === "NO_RATE" || e1.json?.code === "NO_RATE"), JSON.stringify(e1.json).slice(0, 220));
  const e2 = await addLine(sa, BE_BIZ, { expenseType: "other", currency: "AED", amount: 10, taxMode: "exclusive", taxPct: 5, taxCode: "NOPE" });
  check("G2 unknown tax code → 422", e2.status === 422, JSON.stringify(e2.json).slice(0, 220));
  const e3 = await addLine(sa, BE_BIZ, { expenseType: "other", currency: "AED", amount: 10, taxMode: "exclusive", taxPct: 18, taxCode: UAE_TAX });
  check("G3 configured code with the wrong rate → 422", e3.status === 422, JSON.stringify(e3.json).slice(0, 220));
  const e4 = await addLine(sa, BE_BIZ, { expenseType: "other", currency: "AED", amount: 10, taxMode: "exclusive", taxPct: 5 });
  check("G4 taxed line without a tax code → 422", e4.status === 422, JSON.stringify(e4.json).slice(0, 220));
  const e5 = await addLine(sa, BE_PAK_SHIP, { expenseType: "other", currency: "PKR", amount: 100, taxMode: "exclusive", taxPct: 5, taxCode: UAE_TAX });
  check("G5 UAE tax code on a Pakistan bill → 422 (jurisdiction)", e5.status === 422, JSON.stringify(e5.json).slice(0, 220));
  const e6 = await addLine(sa, BE_PAK_SHIP, { expenseType: "other", currency: "PKR", amount: 100, taxMode: "exempt", taxPct: 0, details: "E2E PK" });
  check("G6 an exempt PKR line saves on the Pakistan bill (base PKR, no conversion)", (e6.status === 201 || e6.status === 200) && n2((await lineRow(e6.id)).grand_amount) === 100);
  const pr = await sa("PATCH", `/api/erp/bill-expenses/${BE_BIZ}/lines`, { lineId: L1.id, amount: 200 });
  const r1 = await lineRow(L1.id);
  check("G7 editing a line recalculates it on the server (200 × 3.6725 = 734.50)", pr.status === 200 && n2(r1.local_amount) === 734.5 && n2(r1.grand_amount) === 734.5, `${pr.status} ${r1.local_amount}`);
  await sa("PATCH", `/api/erp/bill-expenses/${BE_BIZ}/lines`, { lineId: L1.id, amount: 100 });
}

// ───────────────────────── H. Business vs Shipping ─────────────────────────
{
  const mk = async (role, extra) => client(await devSession(role, extra));
  const biz = await mk("accountant", { countryId: UAE.country, countryBranchId: UAE.main, cityBranchId: UAE.deira, operationalDomain: "business" });
  const shp = await mk("accountant", { countryId: UAE.country, countryBranchId: UAE.main, cityBranchId: UAE.deira, operationalDomain: "shipping" });
  const countryBoth = await mk("country_admin", { countryId: UAE.country, operationalDomain: "both" });
  const ids = (r) => new Set((r.json?.data?.rows || []).map((x) => x.id));
  const rb = await biz("GET", "/api/erp/bill-expenses?limit=2000");
  const rs = await shp("GET", "/api/erp/bill-expenses?limit=2000");
  const rc = await countryBoth("GET", "/api/erp/bill-expenses?limit=2000");
  check("H1 Business staff's register holds the Business bill, never the Shipping BL bill", rb.status === 200 && ids(rb).has(BE_BIZ) && !ids(rb).has(BE_SHIP), `status ${rb.status}`);
  check("H2 Shipping staff's register holds the Shipping bill, never the Business bill", rs.status === 200 && ids(rs).has(BE_SHIP) && !ids(rs).has(BE_BIZ), `status ${rs.status}`);
  check("H3 Country Admin (both) sees both, but nothing from Pakistan", rc.status === 200 && ids(rc).has(BE_BIZ) && ids(rc).has(BE_SHIP) && !ids(rc).has(BE_PAK_SHIP), `status ${rc.status}`);
  const rcBiz = await countryBoth("GET", "/api/erp/bill-expenses?limit=2000&section=business");
  const rcShp = await countryBoth("GET", "/api/erp/bill-expenses?limit=2000&section=shipping");
  check("H4 section filter: Business → Business only, Shipping Line → Shipping only", ids(rcBiz).has(BE_BIZ) && !ids(rcBiz).has(BE_SHIP) && ids(rcShp).has(BE_SHIP) && !ids(rcShp).has(BE_BIZ));
  const x1 = await biz("POST", `/api/erp/bill-expenses/${BE_SHIP}/lines`, { expenseType: "other", currency: "AED", amount: 10, taxMode: "exempt", taxPct: 0 });
  check("H5 Business staff cannot add a line to a Shipping bill → 403", x1.status === 403, `${x1.status}`);
  const x2 = await shp("GET", `/api/erp/bill-expenses/${BE_BIZ}`);
  check("H6 Shipping staff cannot read a Business bill's lines → 403", x2.status === 403, `${x2.status}`);
  const x3 = await shp("POST", `/api/erp/bill-expenses/${BE_SHIP}/lines`, { expenseType: "other", currency: "AED", amount: 25, taxMode: "exempt", taxPct: 0, details: "E2E shipping staff" });
  if (x3.json?.data?.id) made.push([BE_SHIP, x3.json.data.id]);
  check("H7 Shipping staff can add a line to a Shipping bill", x3.status === 201 || x3.status === 200, `${x3.status} ${JSON.stringify(x3.json).slice(0, 160)}`);
  const x4 = await countryBoth("POST", `/api/erp/bill-expenses/${BE_PAK_SHIP}/lines`, { expenseType: "other", currency: "PKR", amount: 10, taxMode: "exempt", taxPct: 0 });
  check("H8 UAE Country Admin cannot add a line to a Pakistan bill → 403", x4.status === 403, `${x4.status}`);
}

// ───────────────────────── I. ledger posting ─────────────────────────
{
  const bal = async () => (await devQuery((sql) => sql`select id, debit_total, credit_total from public.ledgers where id in (${LEDGER_DR}::uuid, ${LEDGER_CR}::uuid)`))
    .reduce((m, r) => ({ ...m, [r.id]: { d: Number(r.debit_total || 0), c: Number(r.credit_total || 0) } }), {});
  const b0 = await bal();
  const p = await sa("POST", `/api/erp/bill-expenses/${BE_BIZ}/lines/${L2.id}/post`, { expenseAccountId: LEDGER_DR, counterAccountId: LEDGER_CR });
  check("I1 PKR-origin line posts", p.status === 200 && p.json?.data?.entryId, JSON.stringify(p.json).slice(0, 200));
  const b1 = await bal();
  check("I2 expense ledger debited 138.08 AED (the BASE grand amount — the PKR 10,000 is not converted again)", n2(b1[LEDGER_DR].d - b0[LEDGER_DR].d) === 138.08, `Δ=${b1[LEDGER_DR].d - b0[LEDGER_DR].d}`);
  check("I3 counter ledger credited 138.08 AED", n2(b1[LEDGER_CR].c - b0[LEDGER_CR].c) === 138.08);
  const lines = await devQuery((sql) => sql`select debit, credit, currency from public.roznamcha_lines where roznamcha_entry_id = ${p.json?.data?.entryId}::uuid`);
  check("I4 the entry is two AED lines, DR = CR", lines.length === 2 && lines.every((l) => l.currency === "AED") && n2(lines.reduce((s, l) => s + Number(l.debit), 0)) === n2(lines.reduce((s, l) => s + Number(l.credit), 0)), JSON.stringify(lines));
  const p2 = await sa("POST", `/api/erp/bill-expenses/${BE_BIZ}/lines/${L2.id}/post`, { expenseAccountId: LEDGER_DR, counterAccountId: LEDGER_CR });
  check("I5 posting the same line again is refused (409)", p2.status === 409, `${p2.status}`);
  const ed = await sa("PATCH", `/api/erp/bill-expenses/${BE_BIZ}/lines`, { lineId: L2.id, amount: 1 });
  check("I6 a posted line cannot be edited (409)", ed.status === 409, `${ed.status}`);

  // 5-way race on one fresh line
  const R = await addLine(sa, BE_BIZ, { expenseType: "other", currency: "EUR", amount: 10, exchangeRate: 4, taxMode: "exempt", taxPct: 0, details: "E2E race" });
  const rb0 = await bal();
  const res = await race(5, () => sa("POST", `/api/erp/bill-expenses/${BE_BIZ}/lines/${R.id}/post`, { expenseAccountId: LEDGER_DR, counterAccountId: LEDGER_CR }));
  const rb1 = await bal();
  const [ec] = await devQuery((sql) => sql`select count(*)::int n from public.roznamcha_entries where source_module = 'bill_expenses' and source_transaction_id = ${R.id}::uuid and deleted_at is null and status <> 'reversed'`);
  check("I7 5-way race: exactly one post succeeds", res.filter((x) => x.status === 200).length === 1, res.map((x) => x.status).join(","));
  check("I8 race: ledger moved by 40.00 AED once, one live entry", n2(rb1[LEDGER_DR].d - rb0[LEDGER_DR].d) === 40 && ec.n === 1, `Δ=${rb1[LEDGER_DR].d - rb0[LEDGER_DR].d} entries=${ec.n}`);

  // void → a balanced contra entry is posted; the line is unposted again and the ledgers' NET position returns to the start
  const v = await sa("POST", `/api/erp/bill-expenses/${BE_BIZ}/lines/${L2.id}/void`);
  const vR = await sa("POST", `/api/erp/bill-expenses/${BE_BIZ}/lines/${R.id}/void`);
  const b2 = await bal();
  const net = (b, id) => n2(b[id].d - b[id].c);
  check("I9 void reverses the postings: net position of both ledgers is back to the start", v.status === 200 && vR.status === 200 && net(b2, LEDGER_DR) === net(b0, LEDGER_DR) && net(b2, LEDGER_CR) === net(b0, LEDGER_CR), `${v.status}/${vR.status} DR Δnet=${net(b2, LEDGER_DR) - net(b0, LEDGER_DR)} CR Δnet=${net(b2, LEDGER_CR) - net(b0, LEDGER_CR)}`);
  const vr = await lineRow(L2.id);
  check("I10 voided line is no longer 'posted'", vr.posting_status !== "posted", vr.posting_status);
  const v2 = await sa("POST", `/api/erp/bill-expenses/${BE_BIZ}/lines/${L2.id}/void`);
  check("I11 voiding twice is refused", v2.status >= 400 && v2.status < 500, `${v2.status}`);
}

// ───────────────────────── J. consolidated register ─────────────────────────
{
  const reg = await sa("GET", "/api/erp/bill-expenses?limit=2000");
  const d = reg.json?.data;
  check("J1 register totals are per currency: AED and PKR both appear, never added together", Array.isArray(d?.summary?.expenseByCurrency) && d.summary.expenseByCurrency.some((x) => x.currency === "AED"), JSON.stringify(d?.summary?.expenseByCurrency));
  const cur = new Set((d?.summary?.originalByCurrency || []).map((x) => x.currency));
  check("J2 a register spanning several currencies reports mixedCurrency and no single scalar total", cur.size <= 1 || (d.summary.mixedCurrency === true && d.summary.originalTotal === null), `currencies=${[...cur].join(",")} mixed=${d?.summary?.mixedCurrency} total=${d?.summary?.originalTotal}`);
  // every register row's stored total equals the sum of its live lines (no line counted twice, no orphan)
  const bad = await devQuery((sql) => sql`
    select be.id, be.expense_total, coalesce(sum(l.grand_amount), 0) as live
    from public.bill_expenses be left join public.bill_expense_lines l on l.bill_expense_id = be.id and l.deleted_at is null
    where be.deleted_at is null group by be.id, be.expense_total
    having abs(be.expense_total - coalesce(sum(l.grand_amount), 0)) > 0.01`);
  check("J3 every register row's expense_total equals the sum of its live lines (nothing counted twice)", bad.length === 0, bad.slice(0, 3).map((b) => `${b.id.slice(0, 8)}:${b.expense_total}/${b.live}`).join(" "));
  const dupe = await devQuery((sql) => sql`select roznamcha_entry_id, count(*)::int n from public.bill_expense_lines where roznamcha_entry_id is not null and deleted_at is null group by 1 having count(*) > 1`);
  check("J4 no ledger entry is referenced by two expense lines", dupe.length === 0);
  const live = await devQuery((sql) => sql`select source_transaction_id, count(*)::int n from public.roznamcha_entries where source_module = 'bill_expenses' and deleted_at is null and status <> 'reversed' group by 1 having count(*) > 1`);
  check("J5 no expense line has two live ledger entries", live.length === 0, live.map((x) => `${x.source_transaction_id}:${x.n}`).join(","));
}

// ───────────────────────── K. job cost ─────────────────────────
{
  const orders = await devQuery((sql) => sql`
    select o.id from public.clearing_customer_orders o
    where o.deleted_at is null and (exists (select 1 from public.clearing_bill_customer_charges c where c.order_id = o.id and c.deleted_at is null)
                                 or exists (select 1 from public.clearing_payment_bills b where b.order_id = o.id and b.deleted_at is null))
    order by o.created_at desc limit 12`);
  let checked = 0, mixedSeen = 0, bad = [];
  for (const o of orders) {
    const r = await sa("GET", `/api/erp/reports/shipping-job-cost?orderId=${o.id}`);
    const rep = r.json?.data ?? r.json;
    if (r.status !== 200 || !rep?.byCurrency) { bad.push(`${o.id.slice(0, 8)}: HTTP ${r.status}`); continue; }
    checked++;
    const db = await devQuery(async (sql) => ({
      ch: await sql`select upper(currency_code) cur, sum(amount) a, sum(amount) filter (where posting_status = 'posted') p from public.clearing_bill_customer_charges where order_id = ${o.id}::uuid and deleted_at is null group by 1`,
      pb: await sql`select upper(currency_code) cur, sum(total_amount) a, sum(total_amount) filter (where posting_status = 'posted') p from public.clearing_payment_bills where order_id = ${o.id}::uuid and deleted_at is null group by 1`,
      ex: await sql`select upper(coalesce(nullif(cb.local_currency, ''), c.currency_code)) cur, sum(bel.grand_amount) a, sum(bel.grand_amount) filter (where bel.posting_status = 'posted') p
                    from public.bill_expense_lines bel join public.bill_expenses be on be.id = bel.bill_expense_id and be.deleted_at is null
                    left join public.countries c on c.id = be.country_id left join public.city_branches cb on cb.id = be.city_branch_id
                    where bel.deleted_at is null and be.source_table = 'clearing_payment_bills'
                      and be.source_id in (select id from public.clearing_payment_bills where order_id = ${o.id}::uuid and deleted_at is null) group by 1`
    }));
    const exp = new Map(), rev = new Map();
    for (const x of db.ch) rev.set(x.cur, (rev.get(x.cur) || 0) + Number(x.p || 0));
    for (const x of [...db.pb, ...db.ex]) exp.set(x.cur, (exp.get(x.cur) || 0) + Number(x.p || 0));
    const cur = new Set([...rev.keys(), ...exp.keys()]);
    for (const c of cur) {
      const row = rep.byCurrency.find((x) => x.currency === c);
      if (!row || n2(row.revenuePosted) !== n2(rev.get(c) || 0) || n2(row.expensePosted) !== n2(exp.get(c) || 0) || n2(row.net) !== n2((rev.get(c) || 0) - (exp.get(c) || 0))) bad.push(`${o.id.slice(0, 8)} ${c}: report ${JSON.stringify(row)} vs db rev=${rev.get(c)} exp=${exp.get(c)}`);
    }
    if (cur.size > 1) { mixedSeen++; if (rep.mixedCurrency !== true || rep.profit.net !== null) bad.push(`${o.id.slice(0, 8)}: mixed order shows a single profit number`); }
    if (cur.size === 1 && (rep.mixedCurrency || rep.profit.currency !== [...cur][0])) bad.push(`${o.id.slice(0, 8)}: single-currency order mislabelled`);
  }
  check(`K1 Job Cost totals per currency match the database (${checked} orders checked, ${mixedSeen} mixed-currency)`, checked > 0 && bad.length === 0, bad.slice(0, 3).join(" | ") || `${checked} orders`);
}

// ───────────────────────── cleanup ─────────────────────────
for (const [beId, lineId] of made) {
  const row = await lineRow(lineId).catch(() => null);
  if (row && row.posting_status === "posted") await sa("POST", `/api/erp/bill-expenses/${beId}/lines/${lineId}/void`);
  await sa("DELETE", `/api/erp/bill-expenses/${beId}/lines`, { lineId });
}
await devQuery((sql) => sql`delete from public.daily_usd_rates where user_name = ${RATE_TAG}`);

process.exit(summary("bill-expense-lines-e2e") ? 0 : 1);
