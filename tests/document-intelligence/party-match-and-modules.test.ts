import { describe, expect, it } from "vitest";
import { compareBank, convertAmount, crossRate, lineAmount, normalisePartyName, partyNameScore } from "@/lib/document-intelligence/party-match";
import {
  INTAKE_MODULES, accountFitsRole, getIntakeModule, isUuid, missingAccountRoles, moduleForTarget, pruneAccountsForModule,
} from "@/lib/document-intelligence/intake-modules";

describe("party name matching", () => {
  it("matches the document's Seller to the master record despite legal-form noise", () => {
    expect(partyNameScore("Dalian Sunshine Imp & Exp. Co., Ltd.", "DALIAN SUNSHINE IMP. & EXP.")).toBe(1);
    expect(normalisePartyName("DGT LLC")).toBe("dgt");
  });
  it("scores partial overlap lower than exact and unrelated names zero", () => {
    expect(partyNameScore("Dalian Sunshine Plastics", "Dalian Sunshine Imp & Exp")).toBeGreaterThanOrEqual(0.8);
    expect(partyNameScore("Dalian Sunshine", "Shanghai Moonlight")).toBe(0);
    expect(partyNameScore("", "x")).toBe(0);
  });
  it("does not treat two different companies sharing only a city as the same party", () => {
    expect(partyNameScore("Dalian Steel Works", "Dalian Sunshine Imp & Exp")).toBeLessThan(0.5);
  });
});

describe("bank comparison (report only — never creates)", () => {
  const known = [{ id: "b1", bankName: "CHINA CONSTRUCTION BANK", accountNumber: "2121 4501 2002 2300 4364", swift: "PCBCCNBJDLX" }];
  it("matches on account number ignoring spaces", () => {
    expect(compareBank({ accountNo: "2121450120022300 4364" }, known)).toMatchObject({ status: "matched", bankId: "b1" });
  });
  it("reports a changed account at the same bank", () => {
    const r = compareBank({ bankName: "China Construction Bank", accountNo: "9999 0000 1111 2222", swift: "PCBCCNBJDLX" }, known);
    expect(r.status).toBe("changed");
    expect(r.differences[0]).toMatchObject({ field: "accountNumber" });
  });
  it("reports unmatched / none / party without banks", () => {
    expect(compareBank({ bankName: "HSBC", accountNo: "123456789" }, known).status).toBe("unmatched");
    expect(compareBank({}, known).status).toBe("none_extracted");
    expect(compareBank({ accountNo: "123456789" }, []).status).toBe("party_has_no_banks");
  });
});

describe("exchange arithmetic", () => {
  it("50 MT × USD 1,200 = USD 60,000", () => {
    expect(lineAmount(50, 1200)).toBe(60000);
  });
  it("converts once, in the stated direction", () => {
    expect(convertAmount(60000, 3.6725, "multiply")).toBe(220350);
    expect(convertAmount(220350, 3.6725, "divide")).toBe(60000);
    expect(convertAmount(60000, 0)).toBeNull();
    expect(convertAmount(60000, NaN)).toBeNull();
  });
  it("derives a cross rate from two to-USD rates", () => {
    expect(crossRate(1, 0.2723)).toBeCloseTo(3.6725, 3); // 1 USD = 3.6725 AED
    expect(crossRate(null, 1)).toBeNull();
  });
});

describe("module catalogue", () => {
  it("contains every module the user listed", () => {
    for (const id of ["purchase_booking", "local_purchase", "sales_booking", "local_sales", "shipping_bl", "clearing_customs", "customer_order"]) {
      expect(getIntakeModule(id)).not.toBeNull();
    }
  });
  it("Purchase modules need the supplier account, Sales modules the customer account — never the other way round", () => {
    expect(getIntakeModule("purchase_booking")!.required).toEqual(["supplier"]);
    expect(getIntakeModule("local_purchase")!.required).toEqual(["supplier"]);
    expect(getIntakeModule("sales_booking")!.required).toEqual(["customer"]);
    expect(getIntakeModule("local_sales")!.required).toEqual(["customer"]);
  });
  it("Shipping cargo (Customer Order) carries no price / currency", () => {
    expect(getIntakeModule("customer_order")!.financial).toBe(false);
    expect(getIntakeModule("shipping_bl")!.financial).toBe(false);
  });
  it("module ids are unique and every target resolves back to a module", () => {
    const ids = INTAKE_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(moduleForTarget("purchase_orders")!.id).toBe("purchase_booking");
    expect(moduleForTarget("sales_orders")!.id).toBe("sales_booking");
  });
});

describe("switching module clears incompatible account mappings", () => {
  const supplier = "11111111-1111-4111-8111-111111111111";
  const customer = "22222222-2222-4222-8222-222222222222";
  it("Purchase → Sales drops the supplier account", () => {
    const next = pruneAccountsForModule({ supplierAccountId: supplier, customerAccountId: customer }, getIntakeModule("sales_booking"));
    expect(next.supplierAccountId).toBe("");
    expect(next.customerAccountId).toBe(customer);
  });
  it("Purchase Booking → Local Purchase keeps the supplier account", () => {
    const next = pruneAccountsForModule({ supplierAccountId: supplier }, getIntakeModule("local_purchase"));
    expect(next.supplierAccountId).toBe(supplier);
  });
  it("to a module with no accounts clears everything", () => {
    const next = pruneAccountsForModule({ supplierAccountId: supplier }, getIntakeModule("shipping_bl"));
    expect(Object.values(next).every((v) => v === "")).toBe(true);
  });
  it("blocks saving until the required account is a real id", () => {
    expect(missingAccountRoles(getIntakeModule("purchase_booking"), {})).toEqual(["supplier"]);
    expect(missingAccountRoles(getIntakeModule("purchase_booking"), { supplierAccountId: "not-a-uuid" })).toEqual(["supplier"]);
    expect(missingAccountRoles(getIntakeModule("purchase_booking"), { supplierAccountId: supplier })).toEqual([]);
    expect(isUuid(supplier)).toBe(true);
  });
});

describe("account fitting", () => {
  it("an account linked to the matched party always fits (even an 'income' kind account)", () => {
    expect(accountFitsRole("supplier", { id: "a", kind: "income", linkedPartyIds: ["p1"] }, "p1")).toBe(true);
  });
  it("unlinked accounts are filtered by accounting kind, unknown kind never hides an account", () => {
    expect(accountFitsRole("supplier", { id: "a", kind: "liability" }, "p1")).toBe(true);
    expect(accountFitsRole("supplier", { id: "a", kind: "income" }, "p1")).toBe(false);
    expect(accountFitsRole("customer", { id: "a", kind: null }, null)).toBe(true);
  });
});
