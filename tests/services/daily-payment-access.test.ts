import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ErpSession } from "@/lib/auth/session";
const db = vi.hoisted(() => ({ run: vi.fn(), queries: [] as string[], rows: [] as any[][] }));
vi.mock("@/lib/db/local-postgres", () => ({ withLocalPg: (fn: any) => db.run(fn) }));
import { postCanonicalDailyPayment, type CanonicalDailyPaymentInput } from "@/lib/services/canonical-daily-payment-posting-service";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const PK=id(1), Q=id(2), C=id(3);
function actor(overrides: Partial<ErpSession> = {}): ErpSession {
  return { userId: id(9), roles: ["city_branch_admin"], permissions: ["purchases:post", "sales:post"],
    countryIds: [PK], countryBranchIds: [], cityBranchIds: [Q], assignments: [], isSuperAdmin: false,
    isGlobalScope: false, canViewFinancials: true, operationalDomains: ["business"], mobileProfile: "standard", ...overrides } as ErpSession;
}
const payment = (overrides: Partial<CanonicalDailyPaymentInput> = {}): CanonicalDailyPaymentInput => ({
  targetType: "purchase_booking", targetId: id(4), direction: "purchase_payment", condition: "remaining", method: "cash",
  entryDate: "2026-10-18", amount: 100, currencyCode: "USD", exchangeRate: 3.675, debitLedgerId: id(5), creditLedgerId: id(6), ...overrides,
});
beforeEach(() => {
  vi.clearAllMocks(); db.queries = []; db.rows = [];
  db.run.mockImplementation(async (fn) => fn(async (parts: TemplateStringsArray) => {
    const text = parts.join("?"); db.queries.push(text);
    if (/insert|update|post_.*transfer/i.test(text)) throw new Error("Unexpected financial mutation");
    return db.rows.shift() || [];
  }));
});
describe("Daily Payments fail before unauthorized financial writes", () => {
  it("rejects target/direction mismatch before opening a database", async () => {
    await expect(postCanonicalDailyPayment(payment({ direction: "sales_payment" }), actor())).rejects.toThrow("direction");
    expect(db.run).not.toHaveBeenCalled();
  });
  it.each([0, -1, NaN, Infinity])("requires a real positive posting rate (%s)", async (rate) => {
    await expect(postCanonicalDailyPayment(payment({ exchangeRate: rate }), actor())).rejects.toThrow("exchange rate");
    expect(db.run).not.toHaveBeenCalled();
  });
  it("rejects denied financial fields and missing post permission", async () => {
    await expect(postCanonicalDailyPayment(payment(), actor({ canViewFinancials: false }))).rejects.toThrow();
    await expect(postCanonicalDailyPayment(payment(), actor({ permissions: ["purchases:read"] }))).rejects.toThrow();
    expect(db.run).not.toHaveBeenCalled();
  });
  it("rejects another branch's debit ledger", async () => {
    db.rows = [[{ id: id(5), country_id: PK, city_branch_id: C }]];
    await expect(postCanonicalDailyPayment(payment(), actor())).rejects.toMatchObject({ status: 403 });
    expect(db.queries).toHaveLength(1);
  });
  it("rejects another branch's credit ledger", async () => {
    db.rows = [[{ id: id(5), country_id: PK, city_branch_id: Q }], [{ id: id(6), country_id: PK, city_branch_id: C }]];
    await expect(postCanonicalDailyPayment(payment(), actor())).rejects.toMatchObject({ status: 403 });
    expect(db.queries).toHaveLength(2);
  });
  it("rejects an out-of-scope order even with valid ledgers in the caller's branch", async () => {
    db.rows = [[{ id: id(5), country_id: PK, city_branch_id: Q }], [{ id: id(6), country_id: PK, city_branch_id: Q }],
      [{ id: id(4), country_id: PK, city_branch_id: C, currency_code: "USD", order_total: 100, remaining_due: 100 }]];
    await expect(postCanonicalDailyPayment(payment(), actor())).rejects.toMatchObject({ status: 403 });
    expect(db.queries).toHaveLength(3);
  });
});
