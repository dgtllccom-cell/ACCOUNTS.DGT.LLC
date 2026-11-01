import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/local-postgres", () => ({ withLocalPg: vi.fn() }));
vi.mock("@/lib/api/scope-middleware", () => ({ sessionSqlScope: vi.fn(), sqlScopeCondition: vi.fn() }));
vi.mock("@/lib/services/purchase-warehouse-stock", () => ({ stockInToWarehouse: vi.fn() }));
vi.mock("@/lib/api/response", () => ({ ApiClientError: Error }));

import { ensureLaneSchema } from "@/lib/services/purchase-lane-service";

describe("lane schema recovery", () => {
  it("propagates database errors instead of proceeding with missing columns", async () => {
    const denied = new Error("permission denied for table purchase_lane_loads");
    const sql = vi.fn().mockRejectedValue(denied);
    await expect(ensureLaneSchema(sql)).rejects.toBe(denied);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("sends one atomic, correctly delimited block covering all required columns", async () => {
    const statements: string[] = [];
    const sql = vi.fn(async (parts: TemplateStringsArray) => { statements.push(parts.join("")); return []; });
    await ensureLaneSchema(sql);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/DO \$lane_schema\$[\s\S]*END \$lane_schema\$;/);
    for (const column of ["sales_order_id", "remaining_quantity", "transfer_destination"]) {
      expect(statements[0]).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    expect(statements[0]).toContain("conrelid = 'public.purchase_lane_loads'::regclass");
  });
});
