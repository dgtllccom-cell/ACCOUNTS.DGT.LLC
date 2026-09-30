// Real-data E2E verification of the per-leg Insurance feature against DEV
// (csesvyxxjivnkkozgopt only — this script refuses to run against anything else).
// Exercises the ACTUAL application service functions: createOrUpdateInsurancePolicy
// (leg-range validation against the order's real legs) -> createInsurancePremiumBill
// -> approveAndPostPartnerBill (reused, unmodified) -> recordPartnerBillPayment
// (reused, unmodified) -> getInsuranceAlerts (missing-policy + expiring/expired).
//
// Run: npx vite-node --config vitest.config.mjs scripts/e2e-verify-insurance.mts --

import { getDbUrl, withLocalPg } from "../lib/db/local-postgres";
import {
  createOrUpdateInsurancePolicy,
  cancelInsurancePolicy,
  createInsurancePremiumBill,
  listInsurancePoliciesForOrder,
  getInsuranceAlerts,
} from "../lib/services/clearing-insurance-service";
import { approveAndPostPartnerBill, recordPartnerBillPayment } from "../lib/services/clearing-partner-bill-service";
import { saveCustomerOrder, getCustomerOrderById } from "../lib/services/clearing-customer-order-service";

const DEV_HOST_FRAGMENT = "csesvyxxjivnkkozgopt";
const SUPERADMIN_ID = "00000000-0000-4000-8000-000000000001";
const ORDER_ID = "63080d03-35c6-4334-bccd-651ae95f416c"; // CL-ORD-00000042, real existing 5-leg DEV order
const INSURER_LEDGER_ID = "affedc87-9735-4722-8f84-de606c2508c1"; // DEV TEST Chaman External Partner Payable (reused as insurer payable for this test)
const CASH_LEDGER_ID = "f6e468b7-2f12-4e93-9c98-59912b5a8f66"; // DEV TEST Chaman Cash

function assertTrue(label: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error(`FAIL: ${label}`, extra ?? "");
    process.exitCode = 1;
    throw new Error(`Assertion failed: ${label}`);
  }
  console.log(`PASS: ${label}`);
}

function camelize<T extends Record<string, any>>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out as T;
}

async function main() {
  const dbUrl = getDbUrl();
  if (!dbUrl.includes(DEV_HOST_FRAGMENT)) {
    throw new Error(`Refusing to run: DATABASE_URL does not target DEV (${DEV_HOST_FRAGMENT}).`);
  }
  console.log(`Connected to DEV (${DEV_HOST_FRAGMENT}) — confirmed.\n`);

  // ── Part A: leg-range validation against the order's REAL legs ──
  console.log("=== Part A: policy creation + leg-range validation ===");

  let rejectedOutOfRange = false;
  try {
    await createOrUpdateInsurancePolicy(
      {
        orderId: ORDER_ID,
        insurerName: "E2E Test Insurer Co.",
        insurerAccountId: INSURER_LEDGER_ID,
        policyNo: "BOGUS-OUT-OF-RANGE",
        coveredCargo: "Test cargo",
        insuredValue: 1000,
        currency: "PKR",
        coverageFrom: "2026-01-01",
        coverageTo: "2026-12-31",
        fromLegNo: 1,
        toLegNo: 99, // order only has 5 legs
      },
      SUPERADMIN_ID
    );
  } catch (e: any) {
    rejectedOutOfRange = e?.code === "INVALID_LEG_RANGE";
  }
  assertTrue("rejects a leg range that doesn't exist on the real order (leg 99 of 5)", rejectedOutOfRange);

  let rejectedZeroValue = false;
  try {
    await createOrUpdateInsurancePolicy(
      {
        orderId: ORDER_ID,
        insurerName: "E2E Test Insurer Co.",
        policyNo: "BOGUS-ZERO-VALUE",
        coveredCargo: "Test cargo",
        insuredValue: 0,
        currency: "PKR",
        coverageFrom: "2026-01-01",
        coverageTo: "2026-12-31",
        fromLegNo: 2,
        toLegNo: 2,
      },
      SUPERADMIN_ID
    );
  } catch (e: any) {
    rejectedZeroValue = e?.code === "INVALID_INSURED_VALUE";
  }
  assertTrue("rejects a zero insured value", rejectedZeroValue);

  let rejectedBadDates = false;
  try {
    await createOrUpdateInsurancePolicy(
      {
        orderId: ORDER_ID,
        insurerName: "E2E Test Insurer Co.",
        policyNo: "BOGUS-BAD-DATES",
        coveredCargo: "Test cargo",
        insuredValue: 1000,
        currency: "PKR",
        coverageFrom: "2026-12-31",
        coverageTo: "2026-01-01", // end before start
        fromLegNo: 2,
        toLegNo: 2,
      },
      SUPERADMIN_ID
    );
  } catch (e: any) {
    rejectedBadDates = e?.code === "INVALID_DATES";
  }
  assertTrue("rejects coverage end date before start date", rejectedBadDates);

  // Real policy covering legs 2-3 (Iran->Pakistan->Afghanistan), expiring in 5 days
  // (so it also exercises the "expiring soon" alert in Part D).
  const expiringDate = new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0];
  const policyNo = `E2E-POLICY-${Date.now()}`;
  const policy = await createOrUpdateInsurancePolicy(
    {
      orderId: ORDER_ID,
      insurerName: "E2E Test Insurer Co.",
      insurerAccountId: INSURER_LEDGER_ID,
      policyNo,
      coveredCargo: "E2E test cargo — safe to delete",
      insuredValue: 50000,
      currency: "PKR",
      coverageFrom: "2026-01-01",
      coverageTo: expiringDate,
      territory: "Iran-Pakistan-Afghanistan corridor",
      fromLegNo: 2,
      toLegNo: 3,
      premiumAmount: 800,
      premiumCurrency: "PKR",
    },
    SUPERADMIN_ID
  );
  assertTrue("policy created with status=active, from_leg_no=2, to_leg_no=3", policy.status === "active" && policy.from_leg_no === 2 && policy.to_leg_no === 3, policy);

  let duplicateBlocked = false;
  try {
    await createOrUpdateInsurancePolicy(
      { orderId: ORDER_ID, insurerName: "E2E Test Insurer Co.", policyNo, coveredCargo: "dup", insuredValue: 100, currency: "PKR", coverageFrom: "2026-01-01", coverageTo: "2026-12-31", fromLegNo: 2, toLegNo: 2 },
      SUPERADMIN_ID
    );
  } catch (e: any) {
    duplicateBlocked = e?.code === "DUPLICATE_POLICY";
  }
  assertTrue("duplicate insurer+policy_no on the same order is blocked", duplicateBlocked);

  // ── Part B: premium bill lifecycle (reusing the partner-bill posting pipeline verbatim) ──
  console.log("\n=== Part B: premium bill create -> approve/post -> payment ===");

  const bill = await createInsurancePremiumBill(policy.id, SUPERADMIN_ID);
  assertTrue("premium bill created, bill_no starts with CL-INSUR-", String(bill.bill_no).startsWith("CL-INSUR-"), bill.bill_no);
  assertTrue("premium bill total_amount = 800, leg_id is null (multi-leg range 2-3)", Number(bill.total_amount) === 800 && bill.leg_id === null, bill);
  assertTrue("premium bill insurance_policy_id links back to the policy", bill.insurance_policy_id === policy.id, bill);

  let duplicateBillBlocked = false;
  try {
    await createInsurancePremiumBill(policy.id, SUPERADMIN_ID);
  } catch (e: any) {
    duplicateBillBlocked = e?.code === "BILL_ALREADY_EXISTS";
  }
  assertTrue("creating a second bill for the same policy is blocked", duplicateBillBlocked);

  const approved = await approveAndPostPartnerBill(bill.id, SUPERADMIN_ID, { isSuperAdmin: true });
  assertTrue("premium bill approved and posted (posting_status=posted)", approved.bill.posting_status === "posted", approved.bill);
  assertTrue("approval created a real roznamcha_entry_id", !!approved.roznamchaEntryId);

  const payment = await recordPartnerBillPayment({ billId: bill.id, amount: 800, paymentAccountId: CASH_LEDGER_ID, referenceNo: "E2E-INSUR-PAY-1" }, SUPERADMIN_ID);
  assertTrue("full premium payment: paid_amount=800, remaining_balance=0, payment_status=paid", Number(payment.bill.paid_amount) === 800 && Number(payment.bill.remaining_balance) === 0 && payment.bill.payment_status === "paid", payment.bill);

  // ── Part C: single-leg policy attaches directly to that leg's id (not null) ──
  console.log("\n=== Part C: single-leg policy leg_id attribution ===");
  const singleLegPolicy = await createOrUpdateInsurancePolicy(
    {
      orderId: ORDER_ID,
      insurerName: "E2E Test Insurer Co.",
      insurerAccountId: INSURER_LEDGER_ID,
      policyNo: `E2E-SINGLE-${Date.now()}`,
      coveredCargo: "E2E single-leg test cargo",
      insuredValue: 20000,
      currency: "PKR",
      coverageFrom: "2026-01-01",
      coverageTo: "2027-01-01",
      fromLegNo: 5,
      toLegNo: 5,
      premiumAmount: 300,
    },
    SUPERADMIN_ID
  );
  const singleLegBill = await createInsurancePremiumBill(singleLegPolicy.id, SUPERADMIN_ID);
  assertTrue("single-leg policy's premium bill has a real leg_id (not null)", !!singleLegBill.leg_id, singleLegBill.leg_id);
  const realLeg5 = (await getCustomerOrderById(ORDER_ID))!.legs.find((l: any) => l.leg_no === 5);
  assertTrue("that leg_id matches the order's actual leg #5", singleLegBill.leg_id === realLeg5?.id, { billLegId: singleLegBill.leg_id, realLeg5Id: realLeg5?.id });

  // Cancel this one so it doesn't pollute the "missing policy" alert check below via leftover active state confusion.
  await cancelInsurancePolicy(singleLegPolicy.id, ORDER_ID);

  // ── Part D: real, scope-filtered alerts (missing-policy + expiring-soon) ──
  console.log("\n=== Part D: getInsuranceAlerts — missing-policy legs + expiring-soon policies ===");

  // Flag leg 4 as insurance_required with no policy covering it, via the real save path.
  const full = await getCustomerOrderById(ORDER_ID);
  const { party_links, legs: rawLegs, loading_allocations, latest_handover, ...orderOnly } = full as any;
  const camelOrder = camelize<Record<string, any>>(orderOnly);
  const camelLinks = (party_links ?? []).map((r: any) => camelize<Record<string, any>>(r));
  const camelAllocations = (loading_allocations ?? []).map((r: any) => camelize<Record<string, any>>(r));
  const camelLegs = (rawLegs ?? []).map((r: any) => {
    const leg = camelize<Record<string, any>>(r);
    leg.legNo = Number(leg.legNo);
    if (leg.legNo === 4) leg.insuranceRequired = true;
    return leg;
  });
  await saveCustomerOrder({ ...camelOrder, id: ORDER_ID, partyLinks: camelLinks, loadingAllocations: camelAllocations, legs: camelLegs } as any);

  const alertsSuperAdmin = await getInsuranceAlerts({ isSuperAdmin: true });
  const missingLeg4 = alertsSuperAdmin.missingPolicy.find((r: any) => r.order_id === ORDER_ID && r.leg_no === 4);
  assertTrue("missing-policy alert fires for leg 4 (flagged required, no policy covers it)", !!missingLeg4, alertsSuperAdmin.missingPolicy.map((r: any) => r.leg_no));

  const noMissingForLeg2or3 = !alertsSuperAdmin.missingPolicy.find((r: any) => r.order_id === ORDER_ID && (r.leg_no === 2 || r.leg_no === 3));
  assertTrue("no missing-policy alert for legs 2-3 (covered by the active E2E policy)", noMissingForLeg2or3);

  const expiringMatch = alertsSuperAdmin.expiringOrExpired.find((r: any) => r.id === policy.id);
  assertTrue("expiring-soon alert fires for the policy expiring in 5 days", !!expiringMatch && expiringMatch.is_expired === false, expiringMatch);

  // Scope enforcement: a super admin sees it; a user scoped to an unrelated country must NOT.
  const alertsWrongScope = await getInsuranceAlerts({ isSuperAdmin: false, countryId: "00000000-0000-0000-0000-0000000000aa", countryBranchId: null, cityBranchId: null });
  const leaked = alertsWrongScope.missingPolicy.some((r: any) => r.order_id === ORDER_ID) || alertsWrongScope.expiringOrExpired.some((r: any) => r.id === policy.id);
  assertTrue("a user scoped to an unrelated country sees NEITHER alert (no cross-scope leak)", !leaked);

  const alertsRightScope = await getInsuranceAlerts({ isSuperAdmin: false, countryId: full!.country_id, countryBranchId: full!.country_branch_id, cityBranchId: full!.city_branch_id });
  const seenRight = alertsRightScope.missingPolicy.some((r: any) => r.order_id === ORDER_ID && r.leg_no === 4);
  assertTrue("a user scoped to the order's own country DOES see the missing-policy alert", seenRight);

  // ── Part E: listInsurancePoliciesForOrder returns everything joined correctly ──
  console.log("\n=== Part E: listInsurancePoliciesForOrder ===");
  const listed = await listInsurancePoliciesForOrder(ORDER_ID);
  const listedPolicy = listed.find((p: any) => p.id === policy.id);
  assertTrue("listed policy shows posting_status=posted, payment_status=paid, 1 payment", listedPolicy?.posting_status === "posted" && listedPolicy?.payment_status === "paid" && listedPolicy?.payments?.length === 1, listedPolicy);

  console.log("\nALL INSURANCE E2E CHECKS PASSED.");
  console.log(JSON.stringify({ policyId: policy.id, policyNo, billId: bill.id, billNo: bill.bill_no }, null, 2));
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error("\nINSURANCE E2E VERIFICATION FAILED:", err?.message || err);
    process.exit(1);
  });
