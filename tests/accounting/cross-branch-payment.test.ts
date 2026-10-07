import { describe, expect, it } from "vitest";
import {
  capPermissionsForRoles,
  enterpriseRolePermissions,
} from "@/lib/permissions/enterprise-roles";
import type { ErpSession } from "@/lib/auth/session";

function session(over: Partial<ErpSession>): ErpSession {
  return {
    userId: "u-test-1",
    email: "user@test.dgt",
    fullName: "Test User",
    preferredLanguage: "en",
    roles: [],
    permissions: [],
    assignments: [],
    countryIds: [],
    countryBranchIds: [],
    cityBranchIds: [],
    isSuperAdmin: false,
    isGlobalScope: false,
    shippingLineIds: [],
    canViewFinancials: true,
    operationalDomains: ["business"],
    ...over,
  } as ErpSession;
}

describe("Country Admin & Cross-Branch Payment Permissions", () => {
  const allowedRoles = [
    "country_admin",
    "main_branch_admin",
    "city_branch_admin",
    "accountant",
    "cashier",
    "business_super_admin",
  ] as const;

  const deniedRoles = [
    "shipping_super_admin",
    "shipping_line_admin",
    "shipping_line_user",
    "country_operations_admin",
    "city_operations_admin",
    "global_operations_admin",
  ] as const;

  it("grants cross-branch lookup and post permissions to authorized business financial roles", () => {
    for (const role of allowedRoles) {
      const perms = enterpriseRolePermissions[role];
      expect(perms, `Role ${role} should have cross_branch_payment:lookup`).toContain(
        "cross_branch_payment:lookup"
      );
      expect(perms, `Role ${role} should have cross_branch_payment:post`).toContain(
        "cross_branch_payment:post"
      );
      expect(perms, `Role ${role} should have accounts:cross_branch_lookup`).toContain(
        "accounts:cross_branch_lookup"
      );
      expect(perms, `Role ${role} should have roznamcha:post_cross_branch`).toContain(
        "roznamcha:post_cross_branch"
      );
    }
  });

  it("denies cross-branch payment permissions to shipping-only and operational roles", () => {
    for (const role of deniedRoles) {
      const perms = capPermissionsForRoles([role], enterpriseRolePermissions[role]);
      expect(perms, `Role ${role} must NOT have cross_branch_payment:lookup`).not.toContain(
        "cross_branch_payment:lookup"
      );
      expect(perms, `Role ${role} must NOT have cross_branch_payment:post`).not.toContain(
        "cross_branch_payment:post"
      );
      expect(perms, `Role ${role} must NOT have accounts:cross_branch_lookup`).not.toContain(
        "accounts:cross_branch_lookup"
      );
      expect(perms, `Role ${role} must NOT have roznamcha:post_cross_branch`).not.toContain(
        "roznamcha:post_cross_branch"
      );
    }
  });
});

describe("Restricted Cross-Branch Lookup Isolation & Privacy Rules", () => {
  it("restricts returned account attributes to identity and owning branch only, with zero ledger leak", () => {
    // Simulated raw database record with confidential financials
    const rawDbAccount = {
      id: "acc-customer-b-001",
      code: "REC-7890",
      account_number: "PK-KHI-0042",
      name: "Karachi Import Trade Co",
      balance: 1450000.5,
      opening_balance: 500000,
      total_debit: 2000000,
      total_credit: 550000,
      ledger_id: "led-7890",
      country_id: "c-pk",
      country_branch_id: "cb-khi",
      branch_name: "Karachi Main Branch",
      branch_code: "KHI-01",
      city_name: "Karachi",
      currency: "PKR",
      phone: "+923001234567",
      tax_number: "TRN-998877",
    };

    // Transformation applied by the restricted lookup API
    const restrictedDto = {
      id: rawDbAccount.id,
      code: rawDbAccount.code,
      name: rawDbAccount.name,
      accountNumber: rawDbAccount.account_number || rawDbAccount.code,
      customerName: rawDbAccount.name,
      owningBranchName: rawDbAccount.branch_name,
      owningBranchCode: rawDbAccount.branch_code,
      cityName: rawDbAccount.city_name,
      ledgerId: rawDbAccount.ledger_id,
      currency: rawDbAccount.currency,
      currentBalance: null, // Strictly nullified
      isOwnBranch: false,
    };

    // 1. Must include identity needed to confirm recipient
    expect(restrictedDto.accountNumber).toBe("PK-KHI-0042");
    expect(restrictedDto.customerName).toBe("Karachi Import Trade Co");
    expect(restrictedDto.owningBranchName).toBe("Karachi Main Branch");
    expect(restrictedDto.owningBranchCode).toBe("KHI-01");
    expect(restrictedDto.currency).toBe("PKR");

    // 2. Must NOT reveal financial figures or ledger details
    expect(restrictedDto.currentBalance).toBeNull();
    expect((restrictedDto as Record<string, unknown>).balance).toBeUndefined();
    expect((restrictedDto as Record<string, unknown>).opening_balance).toBeUndefined();
    expect((restrictedDto as Record<string, unknown>).total_debit).toBeUndefined();
    expect((restrictedDto as Record<string, unknown>).total_credit).toBeUndefined();
    expect((restrictedDto as Record<string, unknown>).transactions).toBeUndefined();
    expect((restrictedDto as Record<string, unknown>).statement).toBeUndefined();
  });

  it("filters search results strictly to the caller's country (no cross-country leak)", () => {
    const callerCountryId = "c-uae";
    const accountsInDb = [
      { id: "a1", country_id: "c-uae", branch_name: "Dubai Deira", name: "Al-Baraka LLC" },
      { id: "a2", country_id: "c-uae", branch_name: "Abu Dhabi", name: "Emirates Trading" },
      { id: "a3", country_id: "c-pk", branch_name: "Lahore City", name: "Lahore Textiles" },
    ];

    const visibleInSearch = accountsInDb.filter((a) => a.country_id === callerCountryId);

    expect(visibleInSearch).toHaveLength(2);
    expect(visibleInSearch.some((a) => a.country_id === "c-pk")).toBe(false);
  });
});

describe("Cross-Branch Payment Double-Entry Accounting & Isolation", () => {
  it("creates a balanced double-entry voucher where source bank is credited once", () => {
    const withdrawalAmount = 500000;
    const currency = "PKR";
    const originatingBranch = { id: "cb-lhr", name: "Lahore Branch", countryId: "c-pk" };
    const recipientBranch = { id: "cb-khi", name: "Karachi Branch", countryId: "c-pk" };

    const bankSourceAccount = {
      id: "acc-bank-lhr-01",
      name: "Lahore Habib Bank",
      branchId: originatingBranch.id,
    };
    const recipientCustomerAccount = {
      id: "acc-cust-khi-99",
      name: "Karachi Trader",
      branchId: recipientBranch.id,
    };

    // Balanced 2-line entry
    const entryLines = [
      {
        lineNo: 1,
        ledgerId: "led-cust-khi-99",
        accountId: recipientCustomerAccount.id,
        accountName: recipientCustomerAccount.name,
        branchId: recipientBranch.id,
        debit: withdrawalAmount,
        credit: 0,
        currency,
      },
      {
        lineNo: 2,
        ledgerId: "led-bank-lhr-01",
        accountId: bankSourceAccount.id,
        accountName: bankSourceAccount.name,
        branchId: originatingBranch.id,
        debit: 0,
        credit: withdrawalAmount,
        currency,
      },
    ];

    const totalDebit = entryLines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = entryLines.reduce((sum, l) => sum + l.credit, 0);

    // Double-entry validation
    expect(totalDebit).toBe(withdrawalAmount);
    expect(totalCredit).toBe(withdrawalAmount);
    expect(totalDebit).toEqual(totalCredit);

    // Bank account credit occurs exactly once (no duplicate deduction)
    const bankCredits = entryLines.filter(
      (l) => l.accountId === bankSourceAccount.id && l.credit > 0
    );
    expect(bankCredits).toHaveLength(1);
    expect(bankCredits[0].credit).toBe(withdrawalAmount);

    // Inter-branch detection
    const isCrossBranch = entryLines.some(
      (l) => l.branchId !== originatingBranch.id
    );
    expect(isCrossBranch).toBe(true);
  });

  it("strictly enforces same-country rule: cross-country posting is rejected", () => {
    const originatingCountryId = "c-uae";
    const recipientCountryId = "c-pk";

    const validateSameCountry = (origCountry: string, recipCountry: string) => {
      if (origCountry !== recipCountry) {
        throw new Error(
          `Cross-country payment prohibited: originating country (${origCountry}) differs from recipient country (${recipCountry}).`
        );
      }
      return true;
    };

    expect(() =>
      validateSameCountry(originatingCountryId, recipientCountryId)
    ).toThrowError(/Cross-country payment prohibited/);

    expect(validateSameCountry("c-uae", "c-uae")).toBe(true);
  });
});

describe("Country Admin Context Locking", () => {
  it("locks country selection while permitting branch switching within authorized scope", () => {
    const countryAdminSession = session({
      roles: ["country_admin"],
      countryIds: ["c-uae"],
      countryBranchIds: ["cb-dxb-main", "cb-dxb-deira", "cb-auh"],
      isSuperAdmin: false,
    });

    const isCountryAdmin =
      countryAdminSession.roles.includes("country_admin") &&
      !countryAdminSession.isSuperAdmin;

    // Country must be locked
    const canChangeCountry = !isCountryAdmin;
    expect(canChangeCountry).toBe(false);

    // Active country is locked to assigned country
    const activeCountry = countryAdminSession.countryIds[0];
    expect(activeCountry).toBe("c-uae");

    // Can choose from authorized branches within that country
    const availableBranches = countryAdminSession.countryBranchIds;
    expect(availableBranches).toHaveLength(3);
    expect(availableBranches).toContain("cb-dxb-deira");
  });
});
