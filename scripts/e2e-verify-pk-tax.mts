// Real-data E2E verification of the Pakistan Income Tax and Sales Tax modules
// against DEV (csesvyxxjivnkkozgopt only — this script refuses to run against
// anything else). Exercises the ACTUAL application service functions.

import { getDbUrl, withLocalPg } from "../lib/db/local-postgres";
import { uaeTaxService } from "../lib/services/uae-tax-service";
import * as pkit from "../lib/services/pk-income-tax-service";
import * as pkst from "../lib/services/pk-sales-tax-service";
import { ApiClientError } from "../lib/api/response";

const DEV_HOST_FRAGMENT = "csesvyxxjivnkkozgopt";
const SUPERADMIN_ID = "00000000-0000-4000-8000-000000000001";
const PK_COUNTRY_ID = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";

function assertTrue(label: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error(`FAIL: ${label}`, extra ?? "");
    process.exitCode = 1;
    throw new Error(`Assertion failed: ${label}`);
  }
  console.log(`PASS: ${label}`);
}

const S = (isSuperAdmin: boolean) => ({ userId: SUPERADMIN_ID, isSuperAdmin, fullName: "E2E Tester", roles: [] } as any);
const superAdminScope = { countryIds: null, cityBranchIds: null } as any;
const wrongScope = { countryIds: ["00000000-0000-0000-0000-0000000000aa"], cityBranchIds: null } as any;
const rightScope = { countryIds: [PK_COUNTRY_ID], cityBranchIds: null } as any;

async function main() {
  const dbUrl = getDbUrl();
  if (!dbUrl.includes(DEV_HOST_FRAGMENT)) throw new Error(`Refusing to run: DATABASE_URL does not target DEV.`);
  console.log(`Connected to DEV (${DEV_HOST_FRAGMENT}) — confirmed.\n`);

  // ── Setup: a real Pakistan tax entity (reusing uaeTaxService, generic entity CRUD) ──
  const ntn = `E2E-NTN-${Date.now()}`;
  const { id: entityId } = await uaeTaxService.createEntity({
    countryId: PK_COUNTRY_ID, trn: ntn, legalName: "E2E Test Trading Co. (Pakistan)",
    filingFrequency: "monthly", baseCurrency: "PKR", createdBy: SUPERADMIN_ID,
  });
  assertTrue("created a real Pakistan tax entity via the reused uaeTaxService", !!entityId);

  const entities = await uaeTaxService.listEntities(rightScope);
  assertTrue("listEntities (Pakistan-scoped) returns the new entity", entities.some((e: any) => e.id === entityId));
  const entitiesWrongScope = await uaeTaxService.listEntities(wrongScope);
  assertTrue("listEntities scoped to an unrelated country does NOT see the entity", !entitiesWrongScope.some((e: any) => e.id === entityId));

  // ═══════════════════════════ Part A: Income Tax ═══════════════════════════
  console.log("\n=== Part A: Pakistan Income Tax ===");
  const taxYear = 2026;
  const created = await pkit.createReturn(S(true), superAdminScope, { taxEntityId: entityId, taxYear, companyType: "other", ntn });
  assertTrue("createReturn: return_no starts with PKIT-", created.returnNo.startsWith("PKIT-"), created.returnNo);
  assertTrue("createReturn: filingDeadline = 30 Sept of tax year", created.filingDeadline === `${taxYear}-09-30`);

  let dup = false;
  try { await pkit.createReturn(S(true), superAdminScope, { taxEntityId: entityId, taxYear, companyType: "other", ntn }); }
  catch (e: any) { dup = e?.code === "PKIT_EXISTS"; }
  assertTrue("createReturn: duplicate entity+tax_year blocked", dup);

  const updated = await pkit.updateWorking(S(true), superAdminScope, created.id, { taxableIncome: 2_000_000, taxableIncomeSource: "E2E: audited FS FY2025-26", turnover: 10_000_000 });
  assertTrue("updateWorking computed tax at 29% (other company)", updated.computed?.taxPayable === 580_000, updated.computed);

  let notReadyBeforeConfirm = false;
  try { await pkit.actOnReturn(S(true), superAdminScope, created.id, "ready"); }
  catch (e: any) { notReadyBeforeConfirm = e?.code === "RATE_NOT_CONFIRMED"; }
  assertTrue("actOnReturn('ready') BLOCKED before accountant_confirmed — hard server-side gate, not just a UI hint", notReadyBeforeConfirm);

  const confirmed = await pkit.confirmRates(S(true), superAdminScope, created.id);
  assertTrue("confirmRates sets accountant_confirmed = true", confirmed.accountantConfirmed === true);

  const readyRes = await pkit.actOnReturn(S(true), superAdminScope, created.id, "ready");
  assertTrue("actOnReturn('ready') now succeeds after confirmation", readyRes.status === "ready_for_review");

  // four-eyes: same actor cannot review their own prepared return (non-super-admin)
  const nonAdminSession = S(false);
  let fourEyesBlocked = false;
  // Re-derive scope for a non-super-admin: they still need PK access; use rightScope explicitly.
  try { await pkit.actOnReturn(nonAdminSession, rightScope, created.id, "review"); }
  catch (e: any) { fourEyesBlocked = e?.code === "FOUR_EYES"; }
  assertTrue("actOnReturn('review') four-eyes: same non-admin actor who prepared it is blocked from reviewing", fourEyesBlocked);

  const reviewed = await pkit.actOnReturn(S(true), superAdminScope, created.id, "review");
  assertTrue("actOnReturn('review') succeeds for super admin (four-eyes bypass)", reviewed.status === "reviewed");

  let fileNoRef = false;
  try { await pkit.actOnReturn(S(true), superAdminScope, created.id, "file", {}); }
  catch (e: any) { fileNoRef = e?.code === "REFERENCE_REQUIRED"; }
  assertTrue("actOnReturn('file') requires a reference", fileNoRef);

  const filed = await pkit.actOnReturn(S(true), superAdminScope, created.id, "file", { reference: "IRIS-E2E-REF-1" });
  assertTrue("actOnReturn('file') records the IRIS reference and moves to filed", filed.status === "filed");

  const paid = await pkit.actOnReturn(S(true), superAdminScope, created.id, "pay", { reference: "PAY-E2E-REF-1", amount: 580_000 });
  assertTrue("actOnReturn('pay') records payment and moves to paid", paid.status === "paid");

  const finalPkit = await pkit.getReturn(superAdminScope, created.id);
  assertTrue("getReturn: final row shows filing_reference, payment_reference, tax_payable=580000, editable=false", finalPkit.pkReturn.filing_reference === "IRIS-E2E-REF-1" && finalPkit.pkReturn.payment_reference === "PAY-E2E-REF-1" && Number(finalPkit.pkReturn.tax_payable) === 580_000 && finalPkit.editable === false, finalPkit.pkReturn);

  const scopedOutPkit = await pkit.listReturns(wrongScope);
  assertTrue("listReturns scoped to an unrelated country does NOT see the Pakistan return", !scopedOutPkit.some((r: any) => r.id === created.id));
  const scopedInPkit = await pkit.listReturns(rightScope);
  assertTrue("listReturns scoped to Pakistan DOES see the return", scopedInPkit.some((r: any) => r.id === created.id));

  // ═══════════════════════════ Part B: Sales Tax ═══════════════════════════
  console.log("\n=== Part B: Pakistan Sales Tax ===");
  const strn = `E2E-STRN-${Date.now()}`;
  const stCreated = await pkst.createReturn(S(true), superAdminScope, { taxEntityId: entityId, periodYear: 2026, periodMonth: 3, strn });
  assertTrue("createReturn: return_no starts with PKST-", stCreated.returnNo.startsWith("PKST-"));
  assertTrue("createReturn: deadline = 18th of following month", stCreated.filingDeadline === "2026-04-18");

  const stUpdated = await pkst.updateWorking(S(true), superAdminScope, stCreated.id, { outputTaxAmount: 500_000, outputTaxSource: "E2E: sales register", inputTaxAmount: 120_000, inputTaxSource: "E2E: purchase register" });
  assertTrue("updateWorking computed net_payable = output - input = 380000", stUpdated.computed?.netPayable === 380_000, stUpdated.computed);

  let stNotReady = false;
  try { await pkst.actOnReturn(S(true), superAdminScope, stCreated.id, "ready"); }
  catch (e: any) { stNotReady = e?.code === "RATE_NOT_CONFIRMED"; }
  assertTrue("Sales Tax: actOnReturn('ready') BLOCKED before accountant_confirmed", stNotReady);

  await pkst.confirmRates(S(true), superAdminScope, stCreated.id);
  const stReady = await pkst.actOnReturn(S(true), superAdminScope, stCreated.id, "ready");
  assertTrue("Sales Tax: ready succeeds after confirmation", stReady.status === "ready_for_review");
  const stReviewed = await pkst.actOnReturn(S(true), superAdminScope, stCreated.id, "review");
  assertTrue("Sales Tax: review succeeds", stReviewed.status === "reviewed");
  const stFiled = await pkst.actOnReturn(S(true), superAdminScope, stCreated.id, "file", { reference: "IRIS-ST-E2E-1" });
  assertTrue("Sales Tax: file records reference", stFiled.status === "filed");
  const stPaid = await pkst.actOnReturn(S(true), superAdminScope, stCreated.id, "pay", { reference: "PAY-ST-E2E-1", amount: 380_000 });
  assertTrue("Sales Tax: pay records payment", stPaid.status === "paid");

  // Credit scenario: input > output => negative net_payable, isCredit
  const creditReturn = await pkst.createReturn(S(true), superAdminScope, { taxEntityId: entityId, periodYear: 2026, periodMonth: 4, strn });
  const creditUpdate = await pkst.updateWorking(S(true), superAdminScope, creditReturn.id, { outputTaxAmount: 50_000, inputTaxAmount: 200_000 });
  assertTrue("credit scenario: net_payable is negative (carry-forward credit)", creditUpdate.computed?.netPayable === -150_000, creditUpdate.computed);

  // ═══════════════════════════ Part C: real accounting-fact honesty check ═══════════════════════════
  console.log("\n=== Part C: no fabricated data — every figure traces to something a human typed ===");
  const rows = await withLocalPg(async (sql) => sql`select taxable_income_source, rate_source_note from public.pk_income_tax_returns where id = ${created.id}::uuid`);
  assertTrue("taxable_income_source is the real string the preparer entered (not fabricated)", (rows as any[])[0].taxable_income_source === "E2E: audited FS FY2025-26");
  assertTrue("rate_source_note cites the real Income Tax Ordinance source, not an invented figure", String((rows as any[])[0].rate_source_note).includes("Income Tax Ordinance"));

  console.log("\nALL PAKISTAN TAX E2E CHECKS PASSED.");
  console.log(JSON.stringify({ entityId, ntn, pkitReturnId: created.id, pkitReturnNo: created.returnNo, pkstReturnId: stCreated.id, pkstReturnNo: stCreated.returnNo }, null, 2));
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error("\nE2E VERIFICATION FAILED:", err?.message || err);
    process.exit(1);
  });
