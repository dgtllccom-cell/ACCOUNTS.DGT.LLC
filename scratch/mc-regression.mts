/**
 * Multi-currency Purchase / Payment accounting — regression matrix.
 *
 * Exercises post_purchase_booking_transfer -> post_purchase_order_payment ->
 * post_roznamcha_entry -> recalc_purchase_order_payment_totals through the REAL
 * RPC path, on disposable scoped test ledgers, then asserts:
 *   DR = CR, base_currency_amount = amount * exchange_rate (invariant),
 *   original currency/amount preserved, historical FX rate frozen,
 *   AED functional amount correct, recalc paid/remaining correct in purchase ccy,
 *   roznamcha line currency label == base currency (never "AED shown as USD"),
 *   reversal restores balances, duplicate booking blocked.
 *
 * DEV only. All test data is created under a TAG and deleted at the end.
 */
import { withLocalPg } from "../lib/db/local-postgres";

const TAG = "MCREG-" + Date.now().toString(36).toUpperCase();
const ACTOR = "c68e6b08-5b18-4ae1-ba23-99d5825961a9"; // Haji Asmatullah (super admin) — real profile
let PASS = 0, FAIL = 0;
const fails: string[] = [];
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { PASS++; console.log(`  ✓ ${name}${detail ? "  — " + detail : ""}`); }
  else { FAIL++; fails.push(name); console.log(`  ✗ ${name}${detail ? "  — " + detail : ""}`); }
}
const near = (a: number, b: number, eps = 0.01) => Math.abs(Number(a) - Number(b)) <= eps;

await withLocalPg(async (sql) => {
  // ---------------------------------------------------------------- setup
  const uae = (await sql`SELECT id, currency_code FROM countries WHERE iso2='AE' AND deleted_at IS NULL`)[0];
  const uaeBranch = (await sql`SELECT id, country_id FROM country_branches WHERE country_id=${uae.id} AND deleted_at IS NULL LIMIT 1`)[0];
  const uaeCity = (await sql`SELECT id FROM city_branches WHERE country_id=${uae.id} AND deleted_at IS NULL LIMIT 1`)[0];

  const mkLedger = async (code: string, name: string, ccy: string, nb: "debit" | "credit", scope: "country" | "super_admin", countryId: string | null) => {
    const r = (await sql`
      INSERT INTO ledgers (scope, country_id, code, name, currency, normal_balance, is_active)
      VALUES (${scope}::ledger_scope, ${countryId}::uuid, ${code}, ${name}, ${ccy}, ${nb}::ledger_direction, true)
      RETURNING id, currency`)[0];
    return r;
  };

  // AED (UAE base) ledgers
  const aedPurchase = await mkLedger(`${TAG}-AED-PUR`, `${TAG} AED Purchase`, "AED", "debit", "country", uae.id);
  const aedSupplier = await mkLedger(`${TAG}-AED-SUP`, `${TAG} AED Supplier`, "AED", "credit", "country", uae.id);
  const aedBank = await mkLedger(`${TAG}-AED-BANK`, `${TAG} AED Bank`, "AED", "debit", "country", uae.id);
  // a USD-denominated supplier ledger under the AED entity (the DALIAN case)
  const usdSupplierInAED = await mkLedger(`${TAG}-USD-SUP-AED`, `${TAG} USD Supplier (AED entity)`, "USD", "credit", "country", uae.id);
  // USD-functional (super_admin scope, no country -> base currency falls back to the order's USD)
  const usdPurchase = await mkLedger(`${TAG}-USD-PUR`, `${TAG} USD Purchase`, "USD", "debit", "super_admin", null);
  const usdSupplier = await mkLedger(`${TAG}-USD-SUP`, `${TAG} USD Supplier`, "USD", "credit", "super_admin", null);
  const usdCountry = { id: null as string | null };

  const ledgerBal = async (id: string) => Number((await sql`SELECT current_balance FROM ledgers WHERE id=${id}`)[0].current_balance);

  let poSeq = 0;
  const mkPO = async (opts: {
    country: string | null; branch?: string | null; city?: string | null;
    purchaseCurrency: string; exchangeRate: number; orderTotal: number;
  }) => {
    poSeq++;
    const localTotal = opts.orderTotal * opts.exchangeRate;
    const r = (await sql`
      INSERT INTO purchase_orders
        (country_id, country_branch_id, city_branch_id, purchase_order_no, purchase_contract_no,
         currency_code, purchase_currency, payment_currency, exchange_rate, order_total,
         total_goods_original, total_goods_local, total_goods_usd, status, form_data, created_by)
      VALUES
        (${opts.country ?? null}::uuid, ${opts.branch ?? null}::uuid, ${opts.city ?? null}::uuid,
         ${`${TAG}-PO-${poSeq}`}, ${`${TAG}-C-${poSeq}`},
         ${opts.purchaseCurrency}, ${opts.purchaseCurrency}, ${opts.purchaseCurrency},
         ${opts.exchangeRate}, ${opts.orderTotal},
         ${opts.orderTotal}, ${localTotal}, ${opts.orderTotal}, 'Draft',
         ${sql.json({ form: { supplierName: `${TAG} Supplier` } })}, ${ACTOR}::uuid)
      RETURNING id, country_id, exchange_rate, order_total, currency_code`)[0];
    return r;
  };

  const pay = async (poId: string, kind: string, amount: number, ccy: string, rate: number, dr: string, cr: string, date = "2026-02-15") => {
    const rows = await sql`
      SELECT post_purchase_booking_transfer(
        ${ACTOR}::uuid, ${poId}::uuid, ${kind}::purchase_order_payment_kind, ${date}::date,
        ${amount}, ${ccy}, ${rate}, ${dr}::uuid, ${cr}::uuid,
        ${`${TAG}-ref`}, ${`${TAG} ${kind} payment`}
      ) AS pid`;
    return String(rows[0].pid);
  };

  const paymentRow = async (pid: string) => (await sql`
    SELECT kind, amount, currency_code, exchange_rate, base_currency_amount, original_currency_code, roznamcha_entry_id, status
    FROM purchase_order_payments WHERE id=${pid}`)[0];

  const rozLines = async (entryId: string) => await sql`
    SELECT l.payment_entry_type, l.debit, l.credit, l.currency, g.currency AS ledger_ccy, g.name AS ledger
    FROM roznamcha_lines l JOIN ledgers g ON g.id=l.ledger_id
    WHERE l.roznamcha_entry_id=${entryId} ORDER BY l.payment_entry_type`;

  const poRow = async (id: string) => (await sql`
    SELECT order_total, currency_code, purchase_currency, payment_currency, exchange_rate,
           advance_paid, remaining_paid, credit_amount, remaining_due, payment_status, ledger_posting_status
    FROM purchase_orders WHERE id=${id}`)[0];

  const assertPosting = async (label: string, pid: string, expOrigCcy: string, expOrigAmt: number, expRate: number, expBase: number, baseCcy: string) => {
    const p = await paymentRow(pid);
    ok(`${label}: amount preserved (${expOrigCcy} ${expOrigAmt})`, near(Number(p.amount), expOrigAmt) && p.currency_code === expOrigCcy, `got ${p.currency_code} ${p.amount}`);
    ok(`${label}: FX rate frozen = ${expRate}`, near(Number(p.exchange_rate), expRate, 1e-6), `got ${p.exchange_rate}`);
    ok(`${label}: base_currency_amount = amount × rate = ${expBase}`, near(Number(p.base_currency_amount), expBase), `got ${p.base_currency_amount}`);
    ok(`${label}: INVARIANT base = amount × rate`, near(Number(p.base_currency_amount), Number(p.amount) * Number(p.exchange_rate)));
    const rl = await rozLines(p.roznamcha_entry_id);
    const dr = rl.find((x: any) => x.payment_entry_type === "debit");
    const cr = rl.find((x: any) => x.payment_entry_type === "credit");
    ok(`${label}: DR = CR (balanced)`, near(Number(dr.debit), Number(cr.credit)) && near(Number(dr.debit), expBase), `DR ${dr.debit} CR ${cr.credit}`);
    ok(`${label}: roznamcha lines labelled base currency (${baseCcy}), never a foreign ledger's ccy`,
       dr.currency === baseCcy && cr.currency === baseCcy, `DR ${dr.currency} / CR ${cr.currency}`);
    const e = (await sql`SELECT original_currency_code, base_currency_amount FROM roznamcha_entries WHERE id=${p.roznamcha_entry_id}`)[0];
    ok(`${label}: entry keeps original currency ${expOrigCcy} + base ${expBase}`,
       e.original_currency_code === expOrigCcy && near(Number(e.base_currency_amount), expBase), `${e.original_currency_code} / ${e.base_currency_amount}`);
  };

  // ============================================================ SCENARIOS
  console.log(`\n=== [1] USD → AED : purchase USD 220,500 @ 3.675, functional AED (the DSA2025-0908 case) ===`);
  {
    const po = await mkPO({ country: uae.id, branch: uaeBranch.id, city: uaeCity.id, purchaseCurrency: "USD", exchangeRate: 3.675, orderTotal: 220500 });
    const supBal0 = await ledgerBal(usdSupplierInAED.id);
    const bk = await pay(po.id, "booking", 220500, "USD", 3.675, aedPurchase.id, usdSupplierInAED.id);
    await assertPosting("USD→AED booking", bk, "USD", 220500, 3.675, 810337.50, "AED");
    ok("USD→AED: USD supplier ledger moved by the AED base amount (810,337.50), not 220,500",
       near(await ledgerBal(usdSupplierInAED.id) - supBal0, -810337.50), `Δ ${(await ledgerBal(usdSupplierInAED.id) - supBal0).toFixed(2)}`);

    // advance USD 20,050 @ 3.675
    const adv = await pay(po.id, "advance", 20050, "USD", 3.675, usdSupplierInAED.id, aedBank.id);
    await assertPosting("USD→AED advance", adv, "USD", 20050, 3.675, 73683.75, "AED");
    let p = await poRow(po.id);
    ok("USD→AED recalc: advance_paid = 20,050 (purchase ccy USD), not 5,455", near(Number(p.advance_paid), 20050), `got ${p.advance_paid}`);
    ok("USD→AED recalc: remaining_due = 200,450 USD", near(Number(p.remaining_due), 200450), `got ${p.remaining_due}`);
    ok("USD→AED recalc: status partial", p.payment_status === "partial", p.payment_status);

    // final / remaining USD 200,450 @ 3.675
    const fin = await pay(po.id, "remaining", 200450, "USD", 3.675, usdSupplierInAED.id, aedBank.id);
    await assertPosting("USD→AED final", fin, "USD", 200450, 3.675, 736653.75, "AED");
    p = await poRow(po.id);
    ok("USD→AED recalc after final: remaining_due = 0", near(Number(p.remaining_due), 0), `got ${p.remaining_due}`);
    ok("USD→AED recalc after final: status completed", p.payment_status === "completed", p.payment_status);
    ok("USD→AED: total paid (advance+remaining) = order_total 220,500 USD",
       near(Number(p.advance_paid) + Number(p.remaining_paid), 220500), `${p.advance_paid} + ${p.remaining_paid}`);
  }

  console.log(`\n=== [2] AED → AED : purchase AED 50,000 @ 1, functional AED ===`);
  {
    const po = await mkPO({ country: uae.id, branch: uaeBranch.id, city: uaeCity.id, purchaseCurrency: "AED", exchangeRate: 1, orderTotal: 50000 });
    const bk = await pay(po.id, "booking", 50000, "AED", 1, aedPurchase.id, aedSupplier.id);
    await assertPosting("AED→AED booking", bk, "AED", 50000, 1, 50000, "AED");
    const a1 = await pay(po.id, "advance", 15000, "AED", 1, aedSupplier.id, aedBank.id);
    await assertPosting("AED→AED advance", a1, "AED", 15000, 1, 15000, "AED");
    const p = await poRow(po.id);
    ok("AED→AED recalc: advance_paid 15,000, remaining_due 35,000", near(Number(p.advance_paid), 15000) && near(Number(p.remaining_due), 35000), `${p.advance_paid} / ${p.remaining_due}`);
  }

  console.log(`\n=== [3] USD → USD : purchase USD 10,000, functional USD (no country → base = order ccy) ===`);
  {
    const po = await mkPO({ country: null, purchaseCurrency: "USD", exchangeRate: 1, orderTotal: 10000 });
    const bk = await pay(po.id, "booking", 10000, "USD", 1, usdPurchase.id, usdSupplier.id);
    await assertPosting("USD→USD booking", bk, "USD", 10000, 1, 10000, "USD");
    const a1 = await pay(po.id, "advance", 4000, "USD", 1, usdSupplier.id, usdPurchase.id);
    await assertPosting("USD→USD advance", a1, "USD", 4000, 1, 4000, "USD");
    const p = await poRow(po.id);
    ok("USD→USD recalc: advance_paid 4,000, remaining_due 6,000", near(Number(p.advance_paid), 4000) && near(Number(p.remaining_due), 6000), `${p.advance_paid} / ${p.remaining_due}`);
  }

  console.log(`\n=== [4] Multiple partial payments (USD→AED) sum exactly ===`);
  {
    const po = await mkPO({ country: uae.id, branch: uaeBranch.id, city: uaeCity.id, purchaseCurrency: "USD", exchangeRate: 3.68, orderTotal: 100000 });
    await pay(po.id, "booking", 100000, "USD", 3.68, aedPurchase.id, usdSupplierInAED.id);
    for (const amt of [10000, 25000, 15000]) await pay(po.id, "advance", amt, "USD", 3.68, usdSupplierInAED.id, aedBank.id);
    await pay(po.id, "remaining", 50000, "USD", 3.68, usdSupplierInAED.id, aedBank.id);
    const p = await poRow(po.id);
    ok("multi-payment: advance_paid = 50,000 USD", near(Number(p.advance_paid), 50000), `${p.advance_paid}`);
    ok("multi-payment: remaining_paid = 50,000 USD", near(Number(p.remaining_paid), 50000), `${p.remaining_paid}`);
    ok("multi-payment: remaining_due = 0, completed", near(Number(p.remaining_due), 0) && p.payment_status === "completed", `${p.remaining_due} / ${p.payment_status}`);
  }

  console.log(`\n=== [5] Payment in a THIRD currency (EUR) on a USD order, AED functional ===`);
  {
    const po = await mkPO({ country: uae.id, branch: uaeBranch.id, city: uaeCity.id, purchaseCurrency: "USD", exchangeRate: 3.675, orderTotal: 100000 });
    await pay(po.id, "booking", 100000, "USD", 3.675, aedPurchase.id, usdSupplierInAED.id);
    // EUR payment: 9,000 EUR at 4.00 AED/EUR = 36,000 AED base
    const e1 = await pay(po.id, "advance", 9000, "EUR", 4.0, usdSupplierInAED.id, aedBank.id);
    await assertPosting("EUR→AED advance", e1, "EUR", 9000, 4.0, 36000, "AED");
    const p = await poRow(po.id);
    // 36,000 AED / 3.675 = 9,795.9184 USD toward the USD order
    ok("3rd-ccy recalc: advance_paid ≈ 9,795.92 USD (36,000 AED ÷ 3.675)", near(Number(p.advance_paid), 9795.92, 0.05), `got ${p.advance_paid}`);
  }

  console.log(`\n=== [6] Over-payment guard + under-payment OK (via the balanced RPC + recalc) ===`);
  {
    const po = await mkPO({ country: uae.id, branch: uaeBranch.id, city: uaeCity.id, purchaseCurrency: "USD", exchangeRate: 3.675, orderTotal: 5000 });
    await pay(po.id, "booking", 5000, "USD", 3.675, aedPurchase.id, usdSupplierInAED.id);
    await pay(po.id, "advance", 1000, "USD", 3.675, usdSupplierInAED.id, aedBank.id); // under-payment OK
    let p = await poRow(po.id);
    ok("under-payment: remaining_due 4,000 USD, partial", near(Number(p.remaining_due), 4000) && p.payment_status === "partial", `${p.remaining_due}/${p.payment_status}`);
    // pay the rest + extra; recalc clamps remaining_due at 0 (never negative)
    await pay(po.id, "remaining", 4000, "USD", 3.675, usdSupplierInAED.id, aedBank.id);
    await pay(po.id, "credit", 500, "USD", 3.675, usdSupplierInAED.id, aedBank.id); // deliberate over
    p = await poRow(po.id);
    ok("over-payment: remaining_due clamped to 0 (never negative)", Number(p.remaining_due) === 0, `${p.remaining_due}`);
    ok("over-payment: total recorded paid = 4,500 (advance/remaining) + 500 credit = 5,000+ tracked",
       near(Number(p.advance_paid) + Number(p.remaining_paid) + Number(p.credit_amount), 5500), `${p.advance_paid}+${p.remaining_paid}+${p.credit_amount}`);
  }

  console.log(`\n=== [7] Duplicate booking protection ===`);
  {
    const po = await mkPO({ country: uae.id, branch: uaeBranch.id, city: uaeCity.id, purchaseCurrency: "USD", exchangeRate: 3.675, orderTotal: 8000 });
    await pay(po.id, "booking", 8000, "USD", 3.675, aedPurchase.id, usdSupplierInAED.id);
    let blocked = false;
    try { await pay(po.id, "booking", 8000, "USD", 3.675, aedPurchase.id, usdSupplierInAED.id); }
    catch (e: any) { blocked = /already been posted|Duplicate/i.test(e.message); }
    ok("duplicate booking rejected", blocked);
    const n = Number((await sql`SELECT count(*)::int n FROM roznamcha_entries WHERE source_transaction_id=${po.id} AND source_transaction_type='purchase_booking_transfer' AND deleted_at IS NULL AND status<>'cancelled'`)[0].n);
    ok("exactly 1 active booking entry", n === 1, `${n}`);
  }

  console.log(`\n=== [8] Cancellation / reversal restores balances + recalc ===`);
  {
    const po = await mkPO({ country: uae.id, branch: uaeBranch.id, city: uaeCity.id, purchaseCurrency: "USD", exchangeRate: 3.675, orderTotal: 12000 });
    const pBal0 = await ledgerBal(aedPurchase.id), sBal0 = await ledgerBal(usdSupplierInAED.id), bBal0 = await ledgerBal(aedBank.id);
    await pay(po.id, "booking", 12000, "USD", 3.675, aedPurchase.id, usdSupplierInAED.id);
    const adv = await pay(po.id, "advance", 3000, "USD", 3.675, usdSupplierInAED.id, aedBank.id);
    const advRoz = (await paymentRow(adv)).roznamcha_entry_id;
    // reverse the advance
    await sql`SELECT reverse_roznamcha_entry(${advRoz}::uuid, ${TAG + ' reversal'}, NULL::uuid)`;
    await sql`UPDATE purchase_order_payments SET status='cancelled', deleted_at=now() WHERE id=${adv}`;
    await sql`SELECT recalc_purchase_order_payment_totals(${po.id}::uuid)`;
    const p = await poRow(po.id);
    ok("reversal: advance_paid back to 0", near(Number(p.advance_paid), 0), `${p.advance_paid}`);
    ok("reversal: remaining_due back to 12,000 USD", near(Number(p.remaining_due), 12000), `${p.remaining_due}`);
    // reverse the booking too
    const bkRoz = (await sql`SELECT roznamcha_entry_id FROM purchase_order_payments WHERE purchase_order_id=${po.id} AND kind='booking' AND deleted_at IS NULL`)[0].roznamcha_entry_id;
    await sql`SELECT reverse_roznamcha_entry(${bkRoz}::uuid, ${TAG + ' reversal'}, NULL::uuid)`;
    ok("reversal: aedPurchase ledger restored", near(await ledgerBal(aedPurchase.id), pBal0, 0.01), `${(await ledgerBal(aedPurchase.id)) - pBal0}`);
    ok("reversal: usdSupplier ledger restored", near(await ledgerBal(usdSupplierInAED.id), sBal0, 0.01), `${(await ledgerBal(usdSupplierInAED.id)) - sBal0}`);
    ok("reversal: aedBank ledger restored", near(await ledgerBal(aedBank.id), bBal0, 0.01), `${(await ledgerBal(aedBank.id)) - bBal0}`);
  }

  // ---------------------------------------------------------------- teardown
  console.log("\n=== teardown ===");
  const poIds = (await sql`SELECT id FROM purchase_orders WHERE purchase_contract_no LIKE ${TAG + "%"}`).map((r: any) => r.id);
  for (const id of poIds) {
    const rozs = (await sql`SELECT roznamcha_entry_id FROM purchase_order_payments WHERE purchase_order_id=${id}`).map((r: any) => r.roznamcha_entry_id).filter(Boolean);
    await sql`DELETE FROM roznamcha_lines WHERE roznamcha_entry_id = ANY(${rozs}::uuid[])`.catch(() => {});
    await sql`DELETE FROM roznamcha_lines l USING roznamcha_entries e WHERE l.roznamcha_entry_id=e.id AND e.reference_no LIKE ${TAG + "%"}`.catch(() => {});
    await sql`DELETE FROM purchase_order_payments WHERE purchase_order_id=${id}`;
  }
  await sql`DELETE FROM roznamcha_lines l USING roznamcha_entries e WHERE l.roznamcha_entry_id = e.id AND (e.reference_no LIKE ${TAG + "%"} OR e.narration LIKE ${"%" + TAG + "%"})`.catch(() => {});
  await sql`DELETE FROM roznamcha_entries WHERE reference_no LIKE ${TAG + "%"} OR narration LIKE ${"%" + TAG + "%"}`.catch(() => {});
  await sql`DELETE FROM purchase_orders WHERE purchase_contract_no LIKE ${TAG + "%"}`;
  await sql`DELETE FROM ledger_balances lb USING ledgers g WHERE lb.ledger_id=g.id AND g.code LIKE ${TAG + "%"}`.catch(() => {});
  await sql`DELETE FROM ledgers WHERE code LIKE ${TAG + "%"}`;
  console.log("  cleaned", poIds.length, "POs + test ledgers");

  console.log(`\n=== MULTI-CURRENCY REGRESSION: ${PASS} passed / ${FAIL} failed ===`);
  if (FAIL) { console.log("FAILED:", fails.join("; ")); process.exit(1); }
});
