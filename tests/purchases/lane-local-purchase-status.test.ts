import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regression: production has no local_purchases.payment_status column. The lane query must derive the status from
// remaining_balance instead of reading a column that does not exist (that raised "column lp.payment_status does not exist").
describe("lane payment status for local purchases", () => {
  const src = readFileSync("lib/services/purchase-lane-service.ts", "utf8");

  it("does not read lp.payment_status anywhere", () => {
    expect(src).not.toMatch(/lp\.payment_status/);
  });

  it("derives completed/pending from remaining_balance", () => {
    expect(src).toMatch(/from public\.local_purchases lp where lp\.id = l\.source_id\)/);
    expect(src).toMatch(/lp\.remaining_balance is not null and lp\.remaining_balance <= 0\.01 then 'completed' else 'pending'/);
  });
});
