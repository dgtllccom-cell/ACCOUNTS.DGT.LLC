import { describe, expect, it } from "vitest";
import type { ErpSession } from "@/lib/auth/session";
import { authorizeCustomer360, customerModuleScopeSql, customerVisibilitySql, crmActionScopeSql } from "@/lib/crm/customer-360-access";
import { customerCurrencyBalances } from "@/lib/crm/customer-360-balances";
import { customer360ActivitySchema, customer360QuerySchema } from "@/lib/crm/customer-360-validation";
import { recordInSessionScope } from "@/lib/api/scope-middleware";

function session(overrides: Partial<ErpSession> = {}): ErpSession {
  return { userId: "user-1", roles: ["city_branch_admin"], permissions: ["customers:read", "customers:update"],
    countryIds: ["PK"], cityBranchIds: ["QUETTA"], countryBranchIds: [], assignments: [], isSuperAdmin: false,
    isGlobalScope: false, canViewFinancials: true, operationalDomains: ["business"], mobileProfile: "standard",
    ...overrides } as ErpSession;
}
// A tag that renders bound values separately; no database, fixtures, or business writes.
function sql(strings: TemplateStringsArray, ...values: any[]): string {
  return strings.reduce((out, str, i) => out + str + (i < values.length ? JSON.stringify(values[i]) : ""), "");
}
sql.unsafe = (identifier: string) => identifier;

describe("Customer 360 access boundaries", () => {
  it("refuses missing customer permission, financial denial, shipping-only and mobile-only access", () => {
    for (const s of [session({ permissions: [] }), session({ canViewFinancials: false }),
      session({ operationalDomains: ["shipping"] }), session({ mobileProfile: "mobile_field" })]) {
      expect(() => authorizeCustomer360(s)).toThrow();
    }
  });
  it("does not permit an update with only read permission", () => {
    expect(() => authorizeCustomer360(session({ permissions: ["customers:read"] }), "update")).toThrow();
  });
  it("narrows multi-assignment reads to the branch that granted customer access", () => {
    const s = session({ cityBranchIds: ["QUETTA", "CHAMAN"], assignmentGrants: [
      { role: "city_branch_admin", permissions: ["customers:read"], countryIds: ["PK"], cityBranchIds: ["QUETTA"], countryBranchIds: [], assignment: {} },
      { role: "staff_user", permissions: ["tasks:read"], countryIds: ["PK"], cityBranchIds: ["CHAMAN"], countryBranchIds: [], assignment: {} },
    ] as any });
    const narrowed = authorizeCustomer360(s);
    expect(recordInSessionScope(narrowed, { country_id: "PK", city_branch_id: "QUETTA" })).toBe(true);
    expect(recordInSessionScope(narrowed, { country_id: "PK", city_branch_id: "CHAMAN" })).toBe(false);
    expect(s.cityBranchIds).toEqual(["QUETTA", "CHAMAN"]);
  });
  it("fails closed with no assignments; geographic city IDs never become branch grants", () => {
    expect(customerVisibilitySql(sql, session({ countryIds: [], cityBranchIds: [] }))).toContain("FALSE");
    const condition = customerVisibilitySql(sql, session());
    expect(condition).toContain("enterprise_accounts");
    expect(condition).toContain("customer_id");
    expect(condition).not.toContain("c.city_id");
    expect(crmActionScopeSql(sql, session())).toContain("::text[]");
  });
  it("retains the underlying module permission for linked records", () => {
    expect(customerModuleScopeSql(sql, session(), "sales", "so")).toContain("FALSE");
    expect(customerModuleScopeSql(sql, session({ permissions: ["sales:read"] }), "sales", "so")).toContain("QUETTA");
  });
});

describe("original-currency financial summaries", () => {
  it("keeps USD and AED separate and nets each currency independently", () => {
    expect(customerCurrencyBalances([
      { currency_code: "USD", remaining_amount: "100.25" }, { currency_code: "AED", remaining_amount: 367.25 },
    ], [{ currency_code: "USD", remaining_due: "20.10" }])).toEqual([
      { currency: "AED", totalReceivable: 367.25, totalPayable: 0, netPosition: 367.25 },
      { currency: "USD", totalReceivable: 100.25, totalPayable: 20.1, netPosition: 80.15 },
    ]);
  });
  it("does not invent currency or silently accept invalid monetary data", () => {
    expect(customerCurrencyBalances([], [])).toEqual([]);
    expect(customerCurrencyBalances([{ remaining_amount: 12 }], [])[0].currency).toBe("—");
    expect(() => customerCurrencyBalances([{ remaining_amount: "invalid" }], [])).toThrow();
    expect(customerCurrencyBalances([{ currency_code: "usd", remaining_amount: .1 }, { currency_code: "USD", remaining_amount: .2 }], [])[0].totalReceivable).toBe(.3);
  });
});

describe("Customer 360 validation", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  it("accepts a real date and preserves a zero promise amount", () => {
    expect(customer360ActivitySchema.parse({ customerId: id, notes: " Follow up ", promiseDate: "2026-10-18", promiseAmount: 0 })).toMatchObject({ notes: "Follow up", promiseDate: "2026-10-18", promiseAmount: 0, activityType: "Note" });
  });
  it.each([{ promiseDate: "2026-02-31" }, { notes: " " }, { activityType: "PostLedger" }, { promiseAmount: -1 }, { promiseAmount: Infinity }, { customerId: "not-a-uuid" }])("rejects invalid activity %j", (overrides) => {
    expect(customer360ActivitySchema.safeParse({ customerId: id, notes: "Follow up", ...overrides }).success).toBe(false);
  });
  it.each([{ page: "NaN" }, { page: "0" }, { pageSize: "10000" }, { startDate: "2026-10-19", endDate: "2026-10-18" }, { branchId: "other" }])("rejects malformed query %j", (query) => {
    expect(customer360QuerySchema.safeParse(query).success).toBe(false);
  });
});
