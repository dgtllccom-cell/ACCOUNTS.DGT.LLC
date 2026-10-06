// Real-data E2E verification of the new "low_stock_alert" Smart Operations detector
// against DEV (csesvyxxjivnkkozgopt only). DEV currently has zero products with a
// configured min_stock_level/reorder_level, so this script temporarily sets one on a
// real product inside a transaction it always rolls back, to prove the detector's
// query actually fires — it never leaves DEV data changed.

import { withLocalPg, getDbUrl } from "../lib/db/local-postgres";
import { runControlChecks } from "../lib/services/smart-operations-detectors";

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

  // 1. Baseline: with no configured thresholds anywhere in DEV, the detector must report 0.
  const before = await runControlChecks(session);
  const beforeResult = before.results.find((r) => r.detector === "low_stock_alert");
  assertTrue("low_stock_alert detector is registered", !!beforeResult);
  assertTrue("low_stock_alert baseline count is 0 (no product has a threshold configured in DEV)", beforeResult!.count === 0, beforeResult);
  assertTrue("low_stock_alert baseline did not error", !beforeResult!.error);

  // 2. Prove it actually fires: set a real threshold on a real product inside a
  // transaction that is always rolled back, re-run the SAME detector query directly.
  const productId = "13c2f63e-abc7-43bb-aba0-4b412369b97c"; // Almond Kernel, Pakistan, quantity_available 200
  const proof = await withLocalPg(async (sql) => {
    await sql`BEGIN`;
    try {
      await sql`UPDATE public.products SET reorder_level = 250 WHERE id = ${productId}::uuid`;
      const rows = await sql`
        SELECT v.product_name, v.sku, v.stock_status, v.quantity_available, v.suggested_restock_qty
        FROM public.product_low_stock_v v
        WHERE v.stock_status IN ('reorder', 'low') AND v.product_id = ${productId}::uuid`;
      return rows;
    } finally {
      await sql`ROLLBACK`;
    }
  });
  const rows = (proof as any[]) || [];
  assertTrue("with a real threshold set, product_low_stock_v flags the real product", rows.length === 1, rows);
  assertTrue("flagged row has stock_status = 'reorder'", rows[0]?.stock_status === "reorder", rows[0]);
  assertTrue("flagged row's suggested_restock_qty is computed correctly (250 - 200 = 50)", Number(rows[0]?.suggested_restock_qty) === 50, rows[0]);

  // 3. Confirm the rollback truly left DEV unchanged.
  const after = await withLocalPg(async (sql) => sql`SELECT reorder_level FROM public.products WHERE id = ${productId}::uuid`);
  assertTrue("rollback left the real product's reorder_level untouched (still NULL)", (after as any[])[0]?.reorder_level === null, after);

  console.log("\nALL LOW-STOCK DETECTOR E2E CHECKS PASSED.");
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error("\nE2E VERIFICATION FAILED:", err?.message || err);
    process.exit(1);
  });
