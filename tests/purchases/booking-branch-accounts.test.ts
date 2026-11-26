import { describe, expect, it } from "vitest";
import { branchBusinessAccountDefaults, branchBusinessScopeKey, branchDefaultAction, preferSameAccount } from "@/lib/purchases/booking-branch-accounts";

const city = { countryId: "AE", countryBranchId: "Dubai", cityBranchId: "Al Ras" };
const sibling = { ...city, cityBranchId: "Deira" };
const main = { countryId: "AE", countryBranchId: "Dubai", cityBranchId: "" };
const make = (id: string, accountName: string, scope = city, extra = {}) => ({
  ...scope, id, accountName, accountCode: "CODE-" + id, status: "active", operationalDomain: "business", ...extra,
});
const dr = make("ar-buy", "Business Purchase Account");
const cr = make("ar-sell", "Business Sales");
const dr2 = make("deira-buy", "Business Purchases", sibling);

describe("branch-owned automatic Business accounts in Purchase Booking", () => {
  it("never picks a global, parent, sibling country/branch, inactive, or Shipping account", () => {
    const wrong = [
      make("global", "Business Purchase", { countryId: "", countryBranchId: "", cityBranchId: "" }),
      make("main", "Business Purchase", main), dr2,
      make("foreign", "Business Purchase", { ...city, countryId: "PK" }),
      make("regional", "Business Purchase", { ...city, countryBranchId: "Sharjah" }),
      make("shipping", "Business Purchase", city, { operationalDomain: "shipping" }),
      make("unknown-domain", "Business Purchase", city, { operationalDomain: "" }),
      make("inactive", "Business Purchase", city, { status: "inactive" }),
      make("supplier", "Trading Supplier / Liability", city, { kind: "liability" }),
      make("fx", "Foreign Exchange Gain"),
    ];
    expect(branchBusinessAccountDefaults(wrong, city)).toEqual({ purchase: null, sales: null });
    expect(branchBusinessAccountDefaults([...wrong, dr, cr], city)).toEqual({ purchase: dr, sales: cr });
  });

  it("allows a true main-branch account only when the main branch itself is selected", () => {
    const branchAccount = make("main-acc", "Business Sales Account", main);
    expect(branchBusinessAccountDefaults([dr, cr, branchAccount], main)).toEqual({ purchase: null, sales: branchAccount });
    expect(branchBusinessAccountDefaults([branchAccount], city)).toEqual({ purchase: null, sales: null });
  });

  it("waits with country-only scope and leaves ambiguous same-branch defaults blank", () => {
    expect(branchBusinessScopeKey({ countryId: "AE" })).toBeNull();
    expect(branchBusinessAccountDefaults([dr, cr], { countryId: "AE" })).toEqual({ purchase: null, sales: null });
    expect(branchBusinessAccountDefaults([dr, cr, make("duplicate", "Business Purchase")], city)).toEqual({ purchase: null, sales: cr });
  });

  it("clears or replaces only a tracked automatic default; preserves imported, manual, and saved accounts", () => {
    const old = { mode: "automatic" as const, id: dr.id, scope: branchBusinessScopeKey(city)! };
    const options = { savedBill: false, scope: branchBusinessScopeKey(sibling), choice: old, selected: { id: dr.id }, candidate: null };
    expect(branchDefaultAction(options)).toEqual({ type: "clear" });
    expect(branchDefaultAction({ ...options, candidate: dr2 })).toEqual({ type: "select", account: dr2 });
    expect(branchDefaultAction({ ...options, choice: { mode: "manual" }, candidate: dr2 })).toEqual({ type: "keep" });
    expect(branchDefaultAction({ ...options, savedBill: true, candidate: dr2 })).toEqual({ type: "keep" });
    expect(branchDefaultAction({ ...options, choice: null, selected: { name: "Imported vendor" }, candidate: dr2 })).toEqual({ type: "keep" });
    expect(branchDefaultAction({ ...options, scope: old.scope, candidate: dr2 })).toEqual({ type: "keep" });
    expect(branchDefaultAction({ ...options, choice: { mode: "manual" }, selected: {}, candidate: dr2 })).toEqual({ type: "keep" });
  });

  it("never enriches a selected account with a sibling's same code, including explicit manual choices", () => {
    const other = { ...dr2, accountCode: dr.accountCode };
    expect(preferSameAccount([other, dr], dr, dr.accountCode)).toBe(dr);
    expect(preferSameAccount([other], dr, dr.accountCode)).toBe(dr);
    const lookup = make("", "", city, { accountCode: dr.accountCode });
    expect(preferSameAccount([other, dr], lookup, dr.accountCode)).toBe(lookup);
  });
});
