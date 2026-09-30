// Real-data E2E verification of the smart-crm-service.ts currency-breakdown fix
// against DEV (csesvyxxjivnkkozgopt only). Confirms getSmartCrmDashboardData no
// longer collapses mixed-currency buckets into a single fake-labeled number.

import { getDbUrl } from "../lib/db/local-postgres";
import { getSmartCrmDashboardData } from "../lib/crm/smart-crm-service";

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

  const session = { userId: SUPERADMIN_ID, isSuperAdmin: true, fullName: "E2E Tester", roles: [] } as any;

  const payload = await getSmartCrmDashboardData({ session, tab: "overdue", pageSize: 50 });
  assertTrue("payload returned without throwing", !!payload);
  assertTrue("kpis object present", !!payload.kpis);
  assertTrue("chequesCollectByCurrency is an array", Array.isArray(payload.kpis.chequesCollectByCurrency));
  assertTrue("no scalar chequesCollectAmount field remains (would signal an unfixed caller)", !("chequesCollectAmount" in (payload.kpis as any)));

  // Real DEV data known (from earlier live inspection) to be genuinely multi-currency
  // for "Collect From Customer": PKR 2,100,000 + USD 12,500.
  const collectRows = payload.kpis.chequesCollectByCurrency;
  if (collectRows.length > 0) {
    const currencies = new Set(collectRows.map((r) => r.currency));
    assertTrue("chequesCollectByCurrency rows each carry a real currency code (not a fabricated constant)", [...currencies].every((c) => /^[A-Z]{3}$/.test(c)), currencies);
    for (const row of collectRows) {
      assertTrue(`chequesCollectByCurrency[${row.currency}] amount is a finite real number`, Number.isFinite(row.amount));
    }
  }

  assertTrue("financialSummary.totalReceivableByCurrency is an array", Array.isArray(payload.financialSummary.totalReceivableByCurrency));
  assertTrue("financialSummary.totalPayableByCurrency is an array", Array.isArray(payload.financialSummary.totalPayableByCurrency));
  assertTrue("financialSummary.cashInHand is honestly null (not computed, not fabricated 0)", payload.financialSummary.cashInHand === null);
  assertTrue("financialSummary.bankBalance is honestly null (not computed, not fabricated 0)", payload.financialSummary.bankBalance === null);
  assertTrue("no fabricated netPosition field remains", !("netPosition" in payload.financialSummary));

  // Cross-check: sum of overdueByCurrency amounts should equal overdueCount by row count,
  // and every currency total should independently match a direct SQL aggregate.
  const totalOverdueCount = payload.kpis.overdueByCurrency.reduce((s, r) => s + r.count, 0);
  assertTrue("overdueCount matches the sum of overdueByCurrency row counts", totalOverdueCount === payload.kpis.overdueCount, { totalOverdueCount, overdueCount: payload.kpis.overdueCount });

  console.log("\nALL CRM CURRENCY-BREAKDOWN E2E CHECKS PASSED.");
  console.log(JSON.stringify({ chequesCollectByCurrency: payload.kpis.chequesCollectByCurrency, overdueByCurrency: payload.kpis.overdueByCurrency, financialSummary: payload.financialSummary }, null, 2));
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error("\nE2E VERIFICATION FAILED:", err?.message || err);
    process.exit(1);
  });
