import { describe, expect, it, vi } from "vitest";
import { isDemoBankAccountNumber } from "@/lib/services/demo-bank-identity";
import { assertPayableBankId } from "@/lib/services/payment-bank-guard";

vi.mock("@/lib/db/local-postgres", () => ({ withLocalPg: vi.fn(async () => null) }));
vi.mock("@/lib/api/response", () => ({
  ApiClientError: class extends Error {
    constructor(message: string, opts: {code:string;status:number}) { super(message); Object.assign(this, opts); }
  },
}));

const bankId = "00000000-1111-4222-8333-444444444444";
describe("Bank Master non-payable fixture", () => {
  it("blocks a demo bank by canonical account number even if presented as active or with a normal client label", async () => {
    const sql=vi.fn(async () => [{account_number:" demo-nonpay-AE-0001 ",is_active:true}]);
    await expect(assertPayableBankId(bankId, sql)).rejects.toMatchObject({code:"DEMO_BANK_NOT_PAYABLE",status:422});
    expect(sql).toHaveBeenCalledTimes(1);
    expect(sql.mock.calls).toHaveLength(1);
  });
  it("preserves genuine bank identities and ignores unselected bank fields", async () => {
    const sql=vi.fn(async () => [{account_number:"UAE-DEMO-NONPAY-NOT-A-PREFIX"}]);
    await assertPayableBankId("",sql);
    await assertPayableBankId(null,sql);
    expect(sql).not.toHaveBeenCalled();
    await assertPayableBankId(bankId,sql);
    expect(sql).toHaveBeenCalledTimes(1);
    expect(isDemoBankAccountNumber("real-account-123")).toBe(false);
    expect(isDemoBankAccountNumber(null)).toBe(false);
  });
  it("fails closed on a missing, invalid, or unverifiable submitted bank id", async () => {
    await expect(assertPayableBankId("not-a-uuid")).rejects.toMatchObject({code:"INVALID_PAYMENT_BANK"});
    await expect(assertPayableBankId(bankId, async () => [])).rejects.toMatchObject({code:"INVALID_PAYMENT_BANK"});
    await expect(assertPayableBankId(bankId)).rejects.toMatchObject({code:"BANK_ELIGIBILITY_UNAVAILABLE"});
  });
});
