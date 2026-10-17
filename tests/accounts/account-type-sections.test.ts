import { describe, expect, it } from "vitest";
import { accountSectionsFor, isPersonalSubType } from "@/lib/accounts/account-type-sections";

describe("accountSectionsFor — the selected Account Type decides what applies", () => {
  it("Personal / Employee / Expense accounts: basic info only (no customer, company, bank, warehouse, tax)", () => {
    for (const a of [{ accountTitle: "Personal" }, { accountTitle: "Employee" }, { accountTitle: "Expenses Account" }, { accountTitle: "Customer", category: "EX" }]) {
      expect(accountSectionsFor({ ...a, bankRequired: true, warehouseRequired: true, companyRequired: true })).toEqual({ customer: false, company: false, bank: false, warehouse: false, tax: false });
    }
  });
  it("Customer › Personal Account: customer details only — never Bank / Warehouse / Company unless explicitly linked", () => {
    expect(accountSectionsFor({ accountTitle: "Customer", subType: "Personal Account", companyRequired: false, bankRequired: false, warehouseRequired: false }))
      .toEqual({ customer: true, company: false, bank: false, warehouse: false, tax: false });
  });
  it("Bank account: bank details (and not warehouse)", () => {
    expect(accountSectionsFor({ accountTitle: "Bank", subType: "Company Bank", companyRequired: false })).toEqual({ customer: false, company: false, bank: true, warehouse: false, tax: false });
  });
  it("Company account: company + tax", () => {
    expect(accountSectionsFor({ accountTitle: "Company", subType: "Trading Company" })).toEqual({ customer: false, company: true, bank: false, warehouse: false, tax: true });
  });
  it("Warehouse only when the Warehouse link is switched on", () => {
    expect(accountSectionsFor({ accountTitle: "Customer", warehouseRequired: true }).warehouse).toBe(true);
    expect(accountSectionsFor({ accountTitle: "Customer", warehouseRequired: false }).warehouse).toBe(false);
  });
  it("a stored account (no toggles) shows a section only when it has that data", () => {
    expect(accountSectionsFor({ accountTitle: "Customer", hasCustomer: true, hasBank: true })).toEqual({ customer: true, company: false, bank: true, warehouse: false, tax: false });
  });
  it("personal sub-types", () => { expect(isPersonalSubType("Personal Account")).toBe(true); expect(isPersonalSubType("Personal Bank")).toBe(true); expect(isPersonalSubType("Company Bank")).toBe(false); });
});
