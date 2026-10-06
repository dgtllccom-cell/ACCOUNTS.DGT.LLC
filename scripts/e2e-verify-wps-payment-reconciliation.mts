// Real-data E2E verification of the WPS payment-result reconciliation loop-back
// (migration 20261222_wps_payment_result_reconciliation.sql) against DEV
// (csesvyxxjivnkkozgopt only). Builds a fresh, realistically-shaped payroll run
// + SIF using real existing employee/ledger/country references (the same ones
// a real 'paid' run already uses), then exercises the real service function.

import { randomUUID } from "node:crypto";
import { withLocalPg, getDbUrl } from "../lib/db/local-postgres";
import { reconcileWpsPaymentResults } from "../lib/services/hr-wps-service";

const DEV_HOST_FRAGMENT = "csesvyxxjivnkkozgopt";
const SUPERADMIN_ID = "00000000-0000-4000-8000-000000000001";

// Real reference data borrowed from an existing real 'paid' payroll run (same
// country, same real employees, same real payable ledger) — see investigation
// in this session: run 9c960afa-7e80-481c-8989-dd04fd0db31a.
const REAL_COUNTRY_ID = "935dd0b9-8228-43b3-b53d-c06e9ae2882f";
const REAL_EMPLOYEE_1 = "11fba42f-1404-459b-ba39-9baeaddac7e7"; // will be marked PAID
const REAL_EMPLOYEE_2 = "45780848-a670-47a5-a5d7-e4bbc14c1d59"; // will be marked REJECTED
const REAL_PAYABLE_LEDGER = "61ab54d8-9e6a-4e2f-9604-9922a9598d53";
const REAL_BANK_LEDGER = "6b24ea23-9514-4311-aba3-94ba99a993f8";
const REAL_ESTABLISHMENT_ID = "cd0e41bd-d9da-4fe8-8ca5-b22b38fcd7cb";

function assertTrue(label: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error(`FAIL: ${label}`, extra ?? "");
    process.exitCode = 1;
    throw new Error(`Assertion failed: ${label}`);
  }
  console.log(`PASS: ${label}`);
}

const session = { userId: SUPERADMIN_ID, isSuperAdmin: true, fullName: "E2E Tester", roles: [], countryIds: null, assignments: [] } as any;

async function main() {
  const dbUrl = getDbUrl();
  if (!dbUrl.includes(DEV_HOST_FRAGMENT)) throw new Error("Refusing to run: DATABASE_URL does not target DEV.");
  console.log(`Connected to DEV (${DEV_HOST_FRAGMENT}) — confirmed.\n`);

  const runId = randomUUID();
  const runNo = `E2E-WPS-${Date.now()}`;
  const sifId = randomUUID();
  const lineIdPaid = randomUUID();
  const lineIdRejected = randomUUID();
  const sifLineIdPaid = randomUUID();
  const sifLineIdRejected = randomUUID();

  // 1. Create a real, freshly-POSTED payroll run with 2 real-shaped lines.
  await withLocalPg(async (sql) => {
    await sql`
      INSERT INTO public.hr_payroll_runs (id, run_no, country_id, period_month, status, posted_at, created_by)
      VALUES (${runId}, ${runNo}, ${REAL_COUNTRY_ID}, '2026-09', 'posted', now(), ${SUPERADMIN_ID}::uuid)`;
    await sql`
      INSERT INTO public.hr_payroll_run_lines (id, run_id, employee_id, basic_salary, net_salary, currency, exchange_rate, status)
      VALUES
        (${lineIdPaid}, ${runId}, ${REAL_EMPLOYEE_1}::uuid, 1600, 1600, 'AED', 3.66, 'posted'),
        (${lineIdRejected}, ${runId}, ${REAL_EMPLOYEE_2}::uuid, 2200, 2200, 'AED', 3.66, 'posted')`;
    await sql`
      INSERT INTO public.hr_wps_sif_files (id, file_no, run_id, establishment_id, salary_month, period_start, period_end, file_name, content, content_sha256, edr_count, total_amount, currency, status, country_id)
      VALUES (${sifId}, ${runNo}, ${runId}, ${REAL_ESTABLISHMENT_ID}::uuid, '092026', '2026-09-01', '2026-09-30', 'e2e-test.sif', 'x', 'x', 2, 3800, 'AED', 'submitted', ${REAL_COUNTRY_ID})`;
    await sql`
      INSERT INTO public.hr_wps_sif_lines (id, sif_id, employee_id, payroll_line_id, person_id, routing_code, account, days_in_period, fixed_amount, variable_amount, line_no)
      VALUES
        (${sifLineIdPaid}, ${sifId}, ${REAL_EMPLOYEE_1}::uuid, ${lineIdPaid}, '11111111111111', '123456789', 'AE070331234567890123456', 30, 1600, 0, 1),
        (${sifLineIdRejected}, ${sifId}, ${REAL_EMPLOYEE_2}::uuid, ${lineIdRejected}, '22222222222222', '123456789', 'AE070331234567890123457', 30, 2200, 0, 2)`;
  });
  console.log(`Created real freshly-posted E2E payroll run ${runNo} + submitted SIF, 2 lines.\n`);

  // 2. Reconcile: employee 1 -> paid, employee 2 -> rejected.
  const result1 = await reconcileWpsPaymentResults(session, sifId, [
    { employeeId: REAL_EMPLOYEE_1, resultStatus: "paid", bankReference: "E2E-BANKREF-001", amount: 1600 },
    { employeeId: REAL_EMPLOYEE_2, resultStatus: "rejected", resultReason: "E2E: invalid IBAN" },
  ], { paymentLedgerId: REAL_BANK_LEDGER, paymentDate: "2026-09-28" });

  assertTrue("2 outcomes returned", result1.outcomes.length === 2, result1.outcomes);
  const paidOutcome = result1.outcomes.find((o) => o.employeeId === REAL_EMPLOYEE_1);
  const rejectedOutcome = result1.outcomes.find((o) => o.employeeId === REAL_EMPLOYEE_2);
  assertTrue("employee 1 outcome is posted_paid", paidOutcome?.outcome === "posted_paid", paidOutcome);
  assertTrue("employee 2 outcome is marked_rejected", rejectedOutcome?.outcome === "marked_rejected", rejectedOutcome);

  // 3. Verify the REAL row-level effects.
  const lines = await withLocalPg((sql) => sql`SELECT id, status, payment_roznamcha_id, payment_failure_reason FROM public.hr_payroll_run_lines WHERE run_id = ${runId} ORDER BY net_salary`) as any[];
  const paidLine = lines.find((l) => l.id === lineIdPaid);
  const rejectedLine = lines.find((l) => l.id === lineIdRejected);
  assertTrue("paid line status = 'paid'", paidLine.status === "paid", paidLine);
  assertTrue("paid line has a real posted roznamcha id", !!paidLine.payment_roznamcha_id, paidLine);
  assertTrue("rejected line status is UNCHANGED ('posted', not 'paid') — no money posted for a rejected payment", rejectedLine.status === "posted", rejectedLine);
  assertTrue("rejected line records the real failure reason", rejectedLine.payment_failure_reason === "E2E: invalid IBAN", rejectedLine);

  const realAccountingEntry = await withLocalPg((sql) => sql`
    SELECT re.voucher_no, round(COALESCE(sum(rl.debit),0) - COALESCE(sum(rl.credit),0), 2) AS dr_minus_cr
    FROM roznamcha_entries re JOIN roznamcha_lines rl ON rl.roznamcha_entry_id = re.id
    WHERE re.id = ${paidLine.payment_roznamcha_id} GROUP BY re.id, re.voucher_no`) as any[];
  assertTrue("the real posted payment entry is a genuine balanced double-entry (DR - CR = 0)", Number(realAccountingEntry[0]?.dr_minus_cr) === 0, realAccountingEntry);

  const wpsResults = await withLocalPg((sql) => sql`SELECT employee_id, result_status, payment_roznamcha_id FROM public.hr_wps_payment_results WHERE sif_id = ${sifId}`) as any[];
  assertTrue("2 real hr_wps_payment_results rows recorded", wpsResults.length === 2, wpsResults);

  // 4. Duplicate-posting protection: resubmit the SAME batch again.
  const result2 = await reconcileWpsPaymentResults(session, sifId, [
    { employeeId: REAL_EMPLOYEE_1, resultStatus: "paid", bankReference: "E2E-BANKREF-001-DUPLICATE", amount: 1600 },
    { employeeId: REAL_EMPLOYEE_2, resultStatus: "rejected", resultReason: "duplicate submit" },
  ], { paymentLedgerId: REAL_BANK_LEDGER, paymentDate: "2026-09-28" });
  assertTrue("duplicate resubmit: both outcomes are already_reconciled (no double-post)", result2.outcomes.every((o) => o.outcome === "already_reconciled"), result2.outcomes);

  const wpsResultsAfterDup = await withLocalPg((sql) => sql`SELECT count(*)::int AS n FROM public.hr_wps_payment_results WHERE sif_id = ${sifId}`) as any[];
  assertTrue("still exactly 2 hr_wps_payment_results rows after the duplicate resubmit (not 4)", wpsResultsAfterDup[0].n === 2, wpsResultsAfterDup);

  const linesAfterDup = await withLocalPg((sql) => sql`SELECT id, payment_roznamcha_id FROM public.hr_payroll_run_lines WHERE id = ${lineIdPaid}`) as any[];
  assertTrue("the paid line's roznamcha id is UNCHANGED after the duplicate resubmit (no second accounting entry posted)", linesAfterDup[0].payment_roznamcha_id === paidLine.payment_roznamcha_id, linesAfterDup);

  // 5. Direct DB-level duplicate protection (the real hard backstop): try to
  // insert a second hr_wps_payment_results row for the same sif_line_id directly.
  let dbConstraintBlocked = false;
  try {
    await withLocalPg((sql) => sql`
      INSERT INTO public.hr_wps_payment_results (sif_id, sif_line_id, payroll_line_id, employee_id, result_status)
      VALUES (${sifId}, ${sifLineIdPaid}, ${lineIdPaid}, ${REAL_EMPLOYEE_1}::uuid, 'paid')`);
  } catch (e: any) {
    dbConstraintBlocked = /unique|duplicate/i.test(e?.message || "");
  }
  assertTrue("the database UNIQUE(sif_line_id) constraint itself blocks a second row (real hard backstop, not just app logic)", dbConstraintBlocked);

  // 6. Real audit trail.
  const events = await withLocalPg((sql) => sql`SELECT action FROM public.hr_wps_sif_events WHERE sif_id = ${sifId} ORDER BY created_at`) as any[];
  assertTrue("2 real 'payment_reconciled' audit events recorded (initial + duplicate attempt)", events.filter((e) => e.action === "payment_reconciled").length === 2, events);

  console.log("\nALL WPS PAYMENT RECONCILIATION E2E CHECKS PASSED.");
  console.log(JSON.stringify({ runId, runNo, sifId }, null, 2));
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error("\nE2E VERIFICATION FAILED:", err?.message || err);
    process.exit(1);
  });
