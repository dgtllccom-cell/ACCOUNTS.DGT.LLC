// Real-data E2E verification that Smart Operations' control checks cover
// CRM, Inventory and HR/WPS exceptions (item 7 of the FINAL EXECUTION
// INSTRUCTION) against DEV (csesvyxxjivnkkozgopt only). Confirms every
// detector runs without error and that the real groups are represented.

import { getDbUrl } from "../lib/db/local-postgres";
import { runControlChecks, DETECTOR_CODES } from "../lib/services/smart-operations-detectors";

const DEV_HOST_FRAGMENT = "csesvyxxjivnkkozgopt";
const SUPERADMIN_ID = "00000000-0000-4000-8000-000000000001";

function assertTrue(label: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error(`FAIL: ${label}`, extra ?? "");
    process.exitCode = 1;
    throw new Error(`Assertion failed: ${label}`);
  }
  console.log(`PASS: ${label}`);
}

async function main() {
  const dbUrl = getDbUrl();
  if (!dbUrl.includes(DEV_HOST_FRAGMENT)) throw new Error("Refusing to run: DATABASE_URL does not target DEV.");
  console.log(`Connected to DEV (${DEV_HOST_FRAGMENT}) — confirmed.\n`);

  const session = { userId: SUPERADMIN_ID, isSuperAdmin: true, fullName: "E2E Tester", roles: [], countryIds: null } as any;

  const { results } = await runControlChecks(session);
  assertTrue("runControlChecks returns one result per registered detector", results.length === DETECTOR_CODES.length, { results: results.length, codes: DETECTOR_CODES.length });

  const byGroup = new Map<string, string[]>();
  for (const r of results) {
    if (!byGroup.has(r.group)) byGroup.set(r.group, []);
    byGroup.get(r.group)!.push(r.detector);
  }

  assertTrue("CRM group has at least one detector (stale_crm_followup)", (byGroup.get("crm") || []).includes("stale_crm_followup"));
  assertTrue("Inventory group has at least one detector (low_stock_alert)", (byGroup.get("inventory") || []).includes("low_stock_alert"));
  assertTrue("HR group covers payroll, WPS, attendance and document-expiry exceptions", ["payroll_exception", "wps_exception", "missing_attendance_before_payroll", "employee_document_expired"].every((d) => (byGroup.get("hr") || []).includes(d)));

  const errored = results.filter((r) => r.error);
  assertTrue("no detector errored against real DEV data", errored.length === 0, errored.map((r) => r.detector));

  for (const r of results) {
    assertTrue(`${r.detector}: count matches findings.length`, r.count === r.findings.length, r);
    for (const f of r.findings) {
      assertTrue(`${r.detector}: every finding has a real reference + a real deep-link href (never mutates, always links)`, !!f.reference && !!f.href, f);
    }
  }

  console.log("\nGroups covered:", [...byGroup.keys()].sort().join(", "));
  console.log("Detectors with real findings right now:", results.filter((r) => r.count > 0).map((r) => `${r.detector}(${r.count})`).join(", ") || "none");
  console.log("\nALL SMART OPERATIONS COVERAGE CHECKS PASSED.");
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error("\nE2E VERIFICATION FAILED:", err?.message || err);
    process.exit(1);
  });
