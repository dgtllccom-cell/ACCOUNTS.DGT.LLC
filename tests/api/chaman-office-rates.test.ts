// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ session: null as any, existing: [] as any[], calls: [] as any[], auditError: false }));
vi.mock("@/lib/auth/session", () => ({ requireErpSession: async () => state.session }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from(table: string) {
  let filter: string[] | null = null;
  let operation = "read";
  const q: any = {
    select: () => q, is: () => q, order: () => q, limit: () => q,
    in: (key: string, values: string[]) => { state.calls.push(["in", table, key, values]); if (key === "country_id") filter = values; return q; },
    eq: (key: string, value: string) => { if (key === "country_id") filter = [value]; return q; },
    insert: (value: any) => { operation = "insert"; state.calls.push(["insert", table, value]); return q; },
    update: (value: any) => { operation = "update"; state.calls.push(["update", table, value]); return q; },
    maybeSingle: async () => ({ data: table === "countries" ? { name: "Pakistan", currency_code: "PKR" } : { id: "operator" }, error: null }),
    single: async () => ({ data: { id: "rate", country_id: "pk", rate_date: "2026-11-06", credit_rate: 282, debit_rate: 280 }, error: null }),
    then: (resolve: any, reject: any) => {
      const data = table === "daily_usd_rates" ? state.existing : table === "countries" ? [{ id: "pk", name: "Pakistan", currency_code: "PKR" }] : [];
      const result = { data: filter ? data.filter((r: any) => filter!.includes(r.country_id ?? r.id)) : data,
        error: table === "exchange_rate_history" && operation === "insert" && state.auditError ? { message: "Audit unavailable" } : null };
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return q;
} }) }));
import { GET, POST } from "@/app/api/erp/currency/daily-rates/route";
const request = (extra: Record<string, unknown> = {}) => new NextRequest("http://localhost/api/erp/currency/daily-rates", {
  method: "POST", body: JSON.stringify({ countryId: "pk", rateDate: "2026-11-06", rateTime: "11:10 AM", timeZoneOffsetMinutes: -240, debitRate: 280, creditRate: 282, ...extra }),
});
beforeEach(() => {
  state.calls = []; state.existing = []; state.auditError = false;
  state.session = { userId: "operator", fullName: "Authorized Office User", roles: ["shipping_line_admin"], isSuperAdmin: false,
    permissions: ["currency_rates:read", "currency_rates:create", "currency_rates:update"], countryIds: ["pk"], countryBranchIds: ["pk-main"], cityBranchIds: ["chaman"],
    operationalDomains: ["shipping"], assignments: [{ countryId: "pk", countryBranchId: "pk-main", cityBranchId: "chaman" }] };
});
describe("authorized Shipping office daily rate management", () => {
  it("creates the assigned country's rate using the signed-in operator, never a supplied actor name", async () => {
    expect((await POST(request({ userName: "Spoofed Super Admin" }))).status).toBe(200);
    const rate = state.calls.find(([op, table]) => op === "insert" && table === "daily_usd_rates")[2];
    expect(rate).toMatchObject({ country_id: "pk", country_branch_id: null, effective_from: "2026-11-06T07:10:00.000Z", user_name: "Authorized Office User" });
    expect(state.calls.some(([op, table]) => op === "insert" && table === "exchange_rate_history")).toBe(true);
  });
  it("rejects another country without a write", async () => {
    expect((await POST(request({ countryId: "other" }))).status).toBe(403);
    expect(state.calls).toEqual([]);
  });
  it("requires update permission for corrections", async () => {
    state.existing = [{ id: "saved", country_id: "pk", credit_rate: 281, debit_rate: 279 }];
    state.session.permissions = ["currency_rates:create"];
    expect((await POST(request({ action: "correct", reason: "Approved correction" }))).status).toBe(403);
    expect(state.calls.some(([op]) => op === "update" || op === "insert")).toBe(false);
  });
  it("requires a real correction reason even with update permission", async () => {
    state.existing = [{ id: "saved", country_id: "pk", credit_rate: 281, debit_rate: 279 }];
    expect((await POST(request({ action: "correct" }))).status).toBe(409);
    expect(state.calls.some(([op]) => op === "update" || op === "insert")).toBe(false);
  });
  it("records both old DR/CR rates in audit history before an authorized correction", async () => {
    state.existing = [{ id: "saved", country_id: "pk", credit_rate: 281, debit_rate: 279 }];
    expect((await POST(request({ action: "correct", reason: "Approved correction" }))).status).toBe(200);
    const audit = state.calls.find(([op, table]) => op === "insert" && table === "exchange_rate_history")[2];
    expect(audit).toMatchObject({ old_credit_rate: 281, old_debit_rate: 279, new_credit_rate: 282, new_debit_rate: 280, reason: "Approved correction", changed_by: "operator" });
  });
  it("does not update the rate when the audit write fails", async () => {
    state.existing = [{ id: "saved", country_id: "pk", credit_rate: 281, debit_rate: 279 }]; state.auditError = true;
    expect((await POST(request({ action: "correct", reason: "Approved correction" }))).status).toBe(400);
    expect(state.calls.some(([op]) => op === "update")).toBe(false);
  });
  it("an empty country scope cannot read all countries' rates or audit history", async () => {
    state.session.countryIds = []; state.session.assignments = [];
    state.existing = [{ id: "saved", country_id: "pk", credit_rate: 281, debit_rate: 279 }];
    const response = await GET(new NextRequest("http://localhost/api/erp/currency/daily-rates"));
    expect(response.status).toBe(200);
    expect((await response.json()).rates).toEqual([]);
    expect(state.calls).toContainEqual(["in", "daily_usd_rates", "country_id", []]);
    expect(state.calls).toContainEqual(["in", "exchange_rate_history", "country_id", []]);
  });
});
