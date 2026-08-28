import { hrReportsService } from "../lib/services/hr-reports-service";
import type { HrScope } from "../lib/services/hr-api";
const g: HrScope = { countryIds: null, countryBranchIds: null, cityBranchIds: null };
const EMP = "11fba42f-1404-459b-ba39-9baeaddac7e7";
const tests: [any, any][] = [
  ["employee_directory", {}],
  ["attendance", { from: "2026-09-01", to: "2026-09-30" }],
  ["leave", { from: "2026-09-01", to: "2026-09-30" }],
  ["overtime", { from: "2026-09-01", to: "2026-09-30" }],
  ["payroll_register", { periodMonth: "2026-09" }],
  ["salary_slip", { periodMonth: "2026-09", employeeId: EMP }],
  ["employee_ledger", { employeeId: EMP }],
  ["expiring_documents", {}],
  ["gratuity", {}],
  ["audit_history", {}],
];
for (const [t, f] of tests) {
  try {
    const d: any = await hrReportsService.run(t, f, g);
    const rows = d?.rows ?? [];
    const totals = d?.totals ?? d?.summary ?? null;
    console.log(`${t.padEnd(20)} cols=${(d?.columns||[]).length} rows=${rows.length}` + (totals ? ` totals=${JSON.stringify(totals)}` : ""));
    if (t === "payroll_register" && rows.length) console.log("   sample:", JSON.stringify(rows[0]).slice(0,300));
    if (t === "attendance" && rows.length) console.log("   sample:", JSON.stringify(rows[0]).slice(0,300));
    if (t === "leave" && rows.length) console.log("   sample:", JSON.stringify(rows[0]).slice(0,300));
  } catch (e: any) { console.log(`${t.padEnd(20)} ERROR: ${e.message}`); }
}
process.exit(0);
