// Real-data E2E verification of the External Partner Bill workflow against DEV
// (csesvyxxjivnkkozgopt only — this script refuses to run against anything else).
// Exercises the ACTUAL application service functions end-to-end:
//   saveCustomerOrder (leg handler/partner carry-through fix)
//   -> createOrUpdatePartnerBill -> approveAndPostPartnerBill
//   -> recordPartnerBillPayment (partial) -> recordPartnerBillPayment (final)
// then verifies the resulting ledger balances and audit trail directly in Postgres.
//
// Run: npx vite-node --config vitest.config.mjs scripts/e2e-verify-partner-bills.mts --

import { getDbUrl, withLocalPg } from "../lib/db/local-postgres";
import {
  saveCustomerOrder,
  getCustomerOrderById,
  assertRouteContinuity,
  RouteContinuityError,
} from "../lib/services/clearing-customer-order-service";
import {
  createOrUpdatePartnerBill,
  approveAndPostPartnerBill,
  recordPartnerBillPayment,
  listPartnerBillsForOrder,
} from "../lib/services/clearing-partner-bill-service";

// Deterministic snake_case -> camelCase, used to round-trip the real order/
// party-link/leg/allocation rows read from the DB back into saveCustomerOrder's
// camelCase input shape WITHOUT hand-transcribing ~50 field names (error-prone).
// saveCustomerOrder's UPDATE path overwrites every order column it's given
// (not a merge) and unconditionally deletes+conditionally-reinserts party
// links, so touching only "legs" without resending everything else would
// silently wipe this real test order's data — this keeps the round-trip exact.
function camelize<T extends Record<string, any>>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    const camelKey = k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
    out[camelKey] = v;
  }
  return out as T;
}

// Postgres numeric columns come back from postgres.js as strings (to avoid float
// precision loss), but normalizeLegs/orderPayload use `typeof x === "number"`
// checks — round-tripping without coercion would silently null out every
// numeric field on the real order. Coerce the known numeric keys in place.
const NUMERIC_ORDER_KEYS = ["goodsQuantity", "goodsBagsCartons", "goodsGrossWeight", "goodsEmptyWeight", "goodsNetWeight"];
const NUMERIC_LEG_KEYS = ["dutyAmount", "taxAmount", "otherCharges", "estimatedExpenseAmount", "actualExpenseAmount"];
function coerceNumerics(obj: Record<string, any>, keys: string[]) {
  for (const k of keys) {
    if (obj[k] != null && typeof obj[k] !== "number") {
      const n = Number(obj[k]);
      obj[k] = Number.isFinite(n) ? n : null;
    }
  }
  return obj;
}

const DEV_HOST_FRAGMENT = "csesvyxxjivnkkozgopt";
const SUPERADMIN_ID = "00000000-0000-4000-8000-000000000001";
const ORDER_ID = "63080d03-35c6-4334-bccd-651ae95f416c"; // CL-ORD-00000042, real existing multi-leg DEV order
const LEG2_ID = "cfc59ee7-fc61-4a29-9d21-965bf5921315"; // leg 2: Iran -> Pakistan, by_road
const PROVIDER_LEDGER_ID = "affedc87-9735-4722-8f84-de606c2508c1"; // DEV TEST Chaman External Partner Payable
const EXPENSE_LEDGER_ID = "ca605975-4bea-4413-841a-e4493e4d27b1"; // DEV TEST Chaman Shipping Expense
const CASH_LEDGER_ID = "f6e468b7-2f12-4e93-9c98-59912b5a8f66"; // DEV TEST Chaman Cash

function assertTrue(label: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error(`FAIL: ${label}`, extra ?? "");
    process.exitCode = 1;
    throw new Error(`Assertion failed: ${label}`);
  }
  console.log(`PASS: ${label}`);
}

async function ledgerBalance(id: string) {
  return withLocalPg(async (sql) => {
    const [row] = await sql`select current_balance, debit_total, credit_total from public.ledgers where id = ${id}::uuid`;
    return row;
  });
}

async function main() {
  const dbUrl = getDbUrl();
  if (!dbUrl.includes(DEV_HOST_FRAGMENT)) {
    throw new Error(`Refusing to run: DATABASE_URL does not target DEV (${DEV_HOST_FRAGMENT}). Got: ${dbUrl.slice(0, 40)}...`);
  }
  console.log(`Connected to DEV (${DEV_HOST_FRAGMENT}) — confirmed.\n`);

  // ── Part A: server-side route validation + handler/partner carry-through, via the real save path ──
  console.log("=== Part A: saveCustomerOrder (leg continuity + partner attribution) ===");

  const providerBefore = await ledgerBalance(PROVIDER_LEDGER_ID);
  const expenseBefore = await ledgerBalance(EXPENSE_LEDGER_ID);
  const cashBefore = await ledgerBalance(CASH_LEDGER_ID);
  console.log("Opening balances:", { providerBefore, expenseBefore, cashBefore });

  // A1: continuity check accepts the real, already-continuous 5-leg order unchanged.
  const legsBefore = await withLocalPg(async (sql) => sql`
    select leg_no, from_country_id, to_country_id, transport_mode
    from public.clearing_customer_order_legs
    where order_id = ${ORDER_ID}::uuid and deleted_at is null
    order by leg_no asc
  `);
  assertTrue("real DEV order CL-ORD-00000042 has 5 continuous legs", legsBefore.length === 5);
  assertTrue("assertRouteContinuity accepts the real continuous route", (() => {
    try {
      assertRouteContinuity(legsBefore.map((l: any) => ({ legNo: l.leg_no, fromCountryId: l.from_country_id, toCountryId: l.to_country_id, transportMode: l.transport_mode })) as any);
      return true;
    } catch {
      return false;
    }
  })());

  // A2: a discontinuous variant of the same order is rejected.
  const brokenLegs = legsBefore.map((l: any) => ({ legNo: l.leg_no, fromCountryId: l.from_country_id, toCountryId: l.to_country_id, transportMode: l.transport_mode }));
  brokenLegs[2] = { ...brokenLegs[2], fromCountryId: "00000000-0000-0000-0000-000000000fff" }; // break leg 3's origin
  let rejected = false;
  try {
    assertRouteContinuity(brokenLegs as any);
  } catch (e) {
    rejected = e instanceof RouteContinuityError;
  }
  assertTrue("assertRouteContinuity rejects a discontinuous variant", rejected);

  // A3: saveCustomerOrder on the real order, setting leg 2's handler to external_partner
  // via the route-builder's actual input shape, then verifying the DB row reflects it
  // (this is the exact bug that was silently dropping the assignment before the fix).
  // Full round-trip: read the ENTIRE current order (order fields, party links, legs,
  // loading allocations) and resend everything unchanged except leg 2 — see camelize()
  // comment above for why a partial payload would corrupt this real order's data.
  const full = await getCustomerOrderById(ORDER_ID);
  if (!full) throw new Error(`Order ${ORDER_ID} not found — cannot proceed`);

  // getCustomerOrderById returns a FLAT object: {...orderRow, party_links, legs, loading_allocations, latest_handover}.
  const { party_links, legs: rawLegs, loading_allocations, latest_handover, ...orderOnly } = full as any;
  const camelOrder = coerceNumerics(camelize<Record<string, any>>(orderOnly), NUMERIC_ORDER_KEYS);
  const camelLinks = (party_links ?? []).map((r: any) => camelize<Record<string, any>>(r));
  const camelAllocations = (loading_allocations ?? []).map((r: any) => coerceNumerics(camelize<Record<string, any>>(r), ["quantity"]));
  const camelLegsFull = (full.legs ?? []).map((r: any) => {
    const leg = coerceNumerics(camelize<Record<string, any>>(r), NUMERIC_LEG_KEYS);
    leg.legNo = Number(leg.legNo); // integer column, but coerce defensively so === comparisons below are reliable
    return leg;
  });

  assertTrue("round-trip read: order has the expected 5 legs", camelLegsFull.length === 5, { legs: camelLegsFull.length, links: camelLinks.length });
  console.log(`(order currently has ${camelLinks.length} party link(s) — round-tripping as-is, whatever that count is)`);

  function buildLegsPayload(overrideLeg2: boolean, breakLeg4: boolean) {
    return camelLegsFull.map((l: any) => {
      const leg: any = { ...l };
      if (overrideLeg2 && leg.legNo === 2) {
        leg.handlerType = "external_partner";
        leg.partnerType = "transporter";
        leg.partnerName = "E2E Test Transporter Co.";
        leg.partnerAccountId = PROVIDER_LEDGER_ID;
      }
      if (breakLeg4 && leg.legNo === 4) {
        leg.fromCountryId = "00000000-0000-0000-0000-000000000fff";
      }
      return leg;
    });
  }

  function buildFullInput(legs: any[]) {
    return {
      ...camelOrder,
      id: ORDER_ID,
      partyLinks: camelLinks,
      loadingAllocations: camelAllocations,
      legs,
    } as any;
  }

  const saveResult = await saveCustomerOrder(buildFullInput(buildLegsPayload(true, false)));
  const savedLeg2 = saveResult.legs.find((l: any) => l.leg_no === 2);
  assertTrue("saveCustomerOrder persisted handler_type='external_partner' on leg 2 (regression check)", savedLeg2?.handler_type === "external_partner", savedLeg2);
  assertTrue("saveCustomerOrder persisted partner_account_id on leg 2", savedLeg2?.partner_account_id === PROVIDER_LEDGER_ID, savedLeg2);
  assertTrue("saveCustomerOrder persisted partner_type on leg 2", savedLeg2?.partner_type === "transporter", savedLeg2);
  assertTrue("saveCustomerOrder round-trip did not wipe party links", saveResult.partyLinks.length === camelLinks.length, saveResult.partyLinks);
  assertTrue("saveCustomerOrder round-trip did not wipe goods_name", saveResult.order.goods_name === full.goods_name, saveResult.order.goods_name);

  // A4: saveCustomerOrder on the real order rejects a discontinuous edit end-to-end (through the API-layer function, not just the pure validator).
  let saveRejected = false;
  try {
    await saveCustomerOrder(buildFullInput(buildLegsPayload(true, true)));
  } catch (e) {
    saveRejected = e instanceof RouteContinuityError;
  }
  assertTrue("saveCustomerOrder end-to-end rejects a discontinuous route (transaction rolled back)", saveRejected);

  // Confirm the rollback was real: leg 2's partner attribution from the successful save above
  // must still be intact (the rejected discontinuous save must not have partially applied).
  const afterRollbackCheck = await getCustomerOrderById(ORDER_ID);
  const leg2AfterRollback = afterRollbackCheck!.legs.find((l: any) => l.leg_no === 2);
  assertTrue("rejected save left leg 2's prior state untouched (real rollback, not partial write)", leg2AfterRollback?.handler_type === "external_partner", leg2AfterRollback);

  // ── Part B: full partner-bill lifecycle ──
  console.log("\n=== Part B: create -> approve/post -> partial payment -> final settlement ===");

  const bill = await createOrUpdatePartnerBill(
    {
      orderId: ORDER_ID,
      legId: LEG2_ID,
      providerAccountId: PROVIDER_LEDGER_ID,
      expenseAccountId: EXPENSE_LEDGER_ID,
      agentName: "E2E Test Transporter Co.",
      countryOfService: "Pakistan",
      invoiceRef: `E2E-INV-${Date.now()}`,
      expenseCategory: "customs_clearance",
      totalAmount: 1000,
      currencyCode: "PKR",
      exchangeRate: 1,
      remarks: "Automated E2E verification — safe to delete.",
    },
    SUPERADMIN_ID,
    { countryId: full.country_id, countryBranchId: full.country_branch_id, cityBranchId: full.city_branch_id }
  );
  assertTrue("createOrUpdatePartnerBill created a bill with posting_status=unposted", bill.posting_status === "unposted", bill);
  assertTrue("bill total_amount = 1000, remaining_balance = 1000, paid_amount = 0", Number(bill.total_amount) === 1000 && Number(bill.remaining_balance) === 1000 && Number(bill.paid_amount) === 0, bill);

  const approved = await approveAndPostPartnerBill(bill.id, SUPERADMIN_ID, { isSuperAdmin: true });
  assertTrue("approveAndPostPartnerBill posted the bill (posting_status=posted)", approved.bill.posting_status === "posted", approved.bill);
  assertTrue("approveAndPostPartnerBill created a real roznamcha_entry_id", !!approved.roznamchaEntryId);

  // Duplicate-posting protection
  let duplicateBlocked = false;
  try {
    await approveAndPostPartnerBill(bill.id, SUPERADMIN_ID, { isSuperAdmin: true });
  } catch (e: any) {
    duplicateBlocked = e?.code === "ALREADY_POSTED" || /already.*posted/i.test(String(e?.message));
  }
  assertTrue("duplicate approve/post is blocked (ALREADY_POSTED)", duplicateBlocked);

  // Overpayment protection
  let overpaymentBlocked = false;
  try {
    await recordPartnerBillPayment({ billId: bill.id, amount: 5000, paymentAccountId: CASH_LEDGER_ID }, SUPERADMIN_ID);
  } catch (e: any) {
    overpaymentBlocked = e?.code === "OVERPAYMENT_PREVENTED" || /exceeds the outstanding balance/i.test(String(e?.message));
  }
  assertTrue("overpayment (5000 against a 1000 bill) is blocked (OVERPAYMENT_PREVENTED)", overpaymentBlocked);

  // Same-account protection (payment account cannot equal provider account)
  let sameAccountBlocked = false;
  try {
    await recordPartnerBillPayment({ billId: bill.id, amount: 100, paymentAccountId: PROVIDER_LEDGER_ID }, SUPERADMIN_ID);
  } catch (e: any) {
    sameAccountBlocked = e?.code === "SAME_ACCOUNT";
  }
  assertTrue("payment from the provider's own payable account is blocked (SAME_ACCOUNT)", sameAccountBlocked);

  // Partial payment: 600 of 1000
  const partial = await recordPartnerBillPayment({ billId: bill.id, amount: 600, paymentAccountId: CASH_LEDGER_ID, referenceNo: "E2E-PARTIAL-1" }, SUPERADMIN_ID);
  assertTrue("partial payment: paid_amount=600, remaining_balance=400, payment_status=partially_paid", Number(partial.bill.paid_amount) === 600 && Number(partial.bill.remaining_balance) === 400 && partial.bill.payment_status === "partially_paid", partial.bill);

  // Final settlement: remaining 400
  const final = await recordPartnerBillPayment({ billId: bill.id, amount: 400, paymentAccountId: CASH_LEDGER_ID, referenceNo: "E2E-FINAL-1" }, SUPERADMIN_ID);
  assertTrue("final payment: paid_amount=1000, remaining_balance=0, payment_status=paid", Number(final.bill.paid_amount) === 1000 && Number(final.bill.remaining_balance) === 0 && final.bill.payment_status === "paid", final.bill);

  // Overpayment now blocked entirely (bill fully settled, remaining = 0)
  let postSettlementBlocked = false;
  try {
    await recordPartnerBillPayment({ billId: bill.id, amount: 1, paymentAccountId: CASH_LEDGER_ID }, SUPERADMIN_ID);
  } catch (e: any) {
    postSettlementBlocked = e?.code === "OVERPAYMENT_PREVENTED";
  }
  assertTrue("payment against a fully-settled bill is blocked", postSettlementBlocked);

  // ── Part C: accounting reconciliation — verify real ledger balance deltas ──
  console.log("\n=== Part C: accounting reconciliation ===");
  const providerAfter = await ledgerBalance(PROVIDER_LEDGER_ID);
  const expenseAfter = await ledgerBalance(EXPENSE_LEDGER_ID);
  const cashAfter = await ledgerBalance(CASH_LEDGER_ID);
  console.log("Closing balances:", { providerAfter, expenseAfter, cashAfter });

  // Provider payable (credit-normal liability): +1000 credit on posting, -1000 debit on full payment => net 0 change.
  const providerDelta = Number(providerAfter.current_balance) - Number(providerBefore.current_balance);
  assertTrue("provider payable ledger nets back to its opening balance after full settlement", Math.abs(providerDelta) < 0.0001, { providerDelta });

  // Expense ledger (debit-normal): +1000 debit on posting, untouched by payments.
  const expenseDelta = Number(expenseAfter.debit_total) - Number(expenseBefore.debit_total);
  assertTrue("expense ledger debit_total increased by exactly 1000", Math.abs(expenseDelta - 1000) < 0.0001, { expenseDelta });

  // Cash ledger (credit-normal): -1000 total credited out across the two payments.
  const cashDelta = Number(cashAfter.credit_total) - Number(cashBefore.credit_total);
  assertTrue("cash ledger credit_total increased by exactly 1000 (600 + 400 disbursed)", Math.abs(cashDelta - 1000) < 0.0001, { cashDelta });

  // ── Part D: order/leg linkage + permission-relevant listing ──
  console.log("\n=== Part D: order/leg linkage via listPartnerBillsForOrder ===");
  const listed = await listPartnerBillsForOrder(ORDER_ID);
  const listedBill = listed.bills.find((b: any) => b.id === bill.id);
  assertTrue("listPartnerBillsForOrder returns the bill linked to the correct order_id/leg_id", !!listedBill && listedBill.leg_id === LEG2_ID, listedBill);
  assertTrue("listPartnerBillsForOrder returns both payments (2) against the bill", listedBill?.payments?.length === 2, listedBill?.payments);
  const leg2Row = listed.legs.find((l: any) => l.leg_no === 2);
  assertTrue("listed leg 2 shows handler_type=external_partner with correct partner_account linkage", leg2Row?.handler_type === "external_partner" && leg2Row?.partner_account_id === PROVIDER_LEDGER_ID, leg2Row);

  console.log("\nALL E2E CHECKS PASSED.");
  console.log(JSON.stringify({ billId: bill.id, billNo: bill.bill_no, roznamchaEntryIds: [approved.roznamchaEntryId, partial.roznamchaEntryId, final.roznamchaEntryId] }, null, 2));
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error("\nE2E VERIFICATION FAILED:", err?.message || err);
    process.exit(1);
  });
