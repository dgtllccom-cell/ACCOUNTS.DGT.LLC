import { describe, expect, it } from "vitest";
import {
  accountCategoryDeleteRefusal,
  accountCategoryStatus,
  accountUsesCategory,
  canChangeAccountCategoryStatus,
  canManageAccountCategories
} from "@/lib/accounts/account-category-rules";

describe("canManageAccountCategories (permission check)", () => {
  it("allows a global super admin by flag", () => {
    expect(canManageAccountCategories({ isSuperAdmin: true, roles: [] })).toBe(true);
  });

  it("allows a session whose roles include super_admin", () => {
    expect(canManageAccountCategories({ isSuperAdmin: false, roles: ["super_admin"] })).toBe(true);
  });

  it("refuses domain super admins and other operational roles, even with accounts:delete elsewhere", () => {
    expect(canManageAccountCategories({ isSuperAdmin: false, roles: ["business_super_admin"] })).toBe(false);
    expect(canManageAccountCategories({ isSuperAdmin: false, roles: ["shipping_super_admin"] })).toBe(false);
    expect(canManageAccountCategories({ isSuperAdmin: false, roles: ["country_admin"] })).toBe(false);
    expect(canManageAccountCategories({ isSuperAdmin: false, roles: ["accountant"] })).toBe(false);
  });

  it("refuses a missing session or missing roles", () => {
    expect(canManageAccountCategories(null)).toBe(false);
    expect(canManageAccountCategories(undefined)).toBe(false);
    expect(canManageAccountCategories({ isSuperAdmin: null, roles: null })).toBe(false);
  });
});

describe("accountCategoryStatus and status transitions", () => {
  it("reads active, inactive and deleted from is_active and deleted_at", () => {
    expect(accountCategoryStatus({ is_active: true, deleted_at: null })).toBe("active");
    expect(accountCategoryStatus({ is_active: false, deleted_at: null })).toBe("inactive");
    expect(accountCategoryStatus({ is_active: true, deleted_at: "2026-11-22T10:00:00Z" })).toBe("deleted");
    expect(accountCategoryStatus({ is_active: false, deleted_at: new Date("2026-11-22T10:00:00Z") })).toBe("deleted");
  });

  it("allows active <-> inactive and soft delete from either live state", () => {
    expect(canChangeAccountCategoryStatus("active", "inactive")).toBe(true);
    expect(canChangeAccountCategoryStatus("inactive", "active")).toBe(true);
    expect(canChangeAccountCategoryStatus("active", "deleted")).toBe(true);
    expect(canChangeAccountCategoryStatus("inactive", "deleted")).toBe(true);
  });

  it("treats a deleted category as terminal (no restore on this page)", () => {
    expect(canChangeAccountCategoryStatus("deleted", "active")).toBe(false);
    expect(canChangeAccountCategoryStatus("deleted", "inactive")).toBe(false);
    expect(canChangeAccountCategoryStatus("deleted", "deleted")).toBe(false);
  });
});

describe("accountUsesCategory (in-use check, mirrors the delete SQL)", () => {
  const category = { id: "11111111-1111-4111-8111-111111111111", code: "EX" };

  it("counts a live account that stores the category id", () => {
    expect(accountUsesCategory({ category_id: category.id, category: null }, category)).toBe(true);
  });

  it("counts a live account that stores the code, case-insensitively", () => {
    expect(accountUsesCategory({ category_id: null, category: "ex" }, category)).toBe(true);
    expect(accountUsesCategory({ category_id: null, category: "EX" }, category)).toBe(true);
  });

  it("still counts a code match when category_id points elsewhere (refusing is safe, orphaning is not)", () => {
    expect(accountUsesCategory({ category_id: "22222222-2222-4222-8222-222222222222", category: "EX" }, category)).toBe(true);
  });

  it("does not count unrelated codes or ids", () => {
    expect(accountUsesCategory({ category_id: null, category: "EXP" }, category)).toBe(false);
    expect(accountUsesCategory({ category_id: "22222222-2222-4222-8222-222222222222", category: null }, category)).toBe(false);
    expect(accountUsesCategory({ category_id: null, category: null }, category)).toBe(false);
  });

  it("ignores soft-deleted accounts", () => {
    expect(accountUsesCategory({ category_id: category.id, category: "EX", deleted_at: "2026-11-01T00:00:00Z" }, category)).toBe(false);
  });

  it("never matches on a category without a code by code", () => {
    expect(accountUsesCategory({ category_id: null, category: "" }, { id: category.id, code: null })).toBe(false);
  });
});

describe("accountCategoryDeleteRefusal (delete rules)", () => {
  it("allows deleting an unused, non-system category", () => {
    expect(accountCategoryDeleteRefusal({ isSystem: false, liveAccountCount: 0 })).toBeNull();
  });

  it("refuses a category that live accounts use, with the count in the message", () => {
    const refusal = accountCategoryDeleteRefusal({ isSystem: false, liveAccountCount: 3 });
    expect(refusal?.code).toBe("CATEGORY_IN_USE");
    expect(refusal?.message).toContain("3 account(s)");
  });

  it("refuses a system default category even when it is unused", () => {
    expect(accountCategoryDeleteRefusal({ isSystem: true, liveAccountCount: 0 })?.code).toBe("SYSTEM_CATEGORY");
  });

  it("reports the system refusal first when a system category is also in use", () => {
    expect(accountCategoryDeleteRefusal({ isSystem: true, liveAccountCount: 5 })?.code).toBe("SYSTEM_CATEGORY");
  });
});
