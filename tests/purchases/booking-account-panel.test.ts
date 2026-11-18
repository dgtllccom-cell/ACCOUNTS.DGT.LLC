import { describe, expect, it } from "vitest";
import { accountCompanyName, findSelectedAccount, matchesSelectedAccount, resolveAccountCompany } from "@/lib/purchases/booking-account-panel";

// Shapes as the Purchase Booking wizard maps them (mapEnterpriseAccount); values mirror AE-001-0004's two accounts.
const purchaseAcc = { id: "162a0af5", accountCode: "AE-AEDU-PS-001", accountNumber: "ACC-000006", accountName: "Purchase and sales Dubai office", companyId: null, companyName: "" };
const salesAcc = { id: "20585152", accountCode: "AE-AEDU-C-003", accountNumber: "ACC-000014", accountName: "JOY GUO (chin)", companyId: null, companyName: "" };
const otherAcc = { id: "79fea04e", accountCode: "AE-AEDU-BC-001", accountNumber: "ACC-000004", accountName: "Manish kumar", companyId: null, companyName: "" };
const linkedAcc = { id: "a1", accountCode: "AE-X-1", accountName: "Linked party", companyId: "c2", companyName: "" };
const companies = [
  { id: "c1", name: "DAMAAN GENERAL TRADING L.L.C" },
  { id: "c2", name: "IMPOTRS EXPOTRS" },
];
const accounts = [otherAcc, purchaseAcc, salesAcc, linkedAcc];

describe("Purchase Booking account panels", () => {
  it("finds the saved account by id even when the saved account no. is the ledger number, not the code", () => {
    expect(findSelectedAccount(accounts, "20585152", "ACC-000014", "JOY GUO (chin)")).toBe(salesAcc);
    expect(findSelectedAccount(accounts, "162a0af5", "ACC-000006", "")).toBe(purchaseAcc);
    expect(findSelectedAccount(accounts, "", "ACC-000006", "")).toBe(purchaseAcc);
  });

  it("never matches on empty id / code / name", () => {
    expect(findSelectedAccount(accounts, "", "", "")).toBeNull();
    expect(matchesSelectedAccount(otherAcc, null, null, null)).toBe(false);
  });

  it("matches by name only when no id or code was saved", () => {
    expect(findSelectedAccount(accounts, "", "", "Manish kumar")).toBe(otherAcc);
    expect(findSelectedAccount(accounts, "missing-id", "", "Manish kumar")).toBeNull();
  });

  it("shows no company for an account with no company, even when the bill saved one (AE-001-0004)", () => {
    const comp = resolveAccountCompany(salesAcc, companies, "c1");
    expect(comp).toBeNull();
    expect(accountCompanyName(salesAcc, comp)).toBe("");
  });

  it("shows the company the account itself links to", () => {
    const comp = resolveAccountCompany(linkedAcc, companies, "c1");
    expect(comp?.name).toBe("IMPOTRS EXPOTRS");
    expect(accountCompanyName(linkedAcc, comp)).toBe("IMPOTRS EXPOTRS");
  });

  it("falls back to the saved company id only when the account master is not loaded", () => {
    expect(resolveAccountCompany(null, companies, "c2")?.name).toBe("IMPOTRS EXPOTRS");
    expect(resolveAccountCompany(null, companies, "")).toBeNull();
  });
});
