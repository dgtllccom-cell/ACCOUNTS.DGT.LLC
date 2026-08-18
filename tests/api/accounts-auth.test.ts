import { describe, expect, it } from "vitest";
import { enterpriseAccountCreateSchema } from "@/lib/api/erp-validation";
import { hasPermission, systemRoles } from "@/lib/permissions/model";

describe("Account Operations Authentication and Validation", () => {
  describe("Account Creation Validation", () => {
    it("validates and normalizes valid enterprise account creation payload", () => {
      const payload = {
        scope: "super_admin",
        code: "AUTO",
        name: "Cash in Hand",
        kind: "asset",
        currency: "usd",
        openingBalance: 0,
        isControlAccount: false
      };

      const parsed = enterpriseAccountCreateSchema.parse(payload);
      expect(parsed.currency).toBe("USD");
      expect(parsed.kind).toBe("asset");
      expect(parsed.name).toBe("Cash in Hand");
    });

    it("rejects invalid kind or missing mandatory fields", () => {
      expect(() => {
        enterpriseAccountCreateSchema.parse({
          scope: "super_admin",
          code: "1001",
          name: "Test",
          kind: "invalid_kind",
          currency: "USD"
        });
      }).toThrow();
    });
  });

  describe("Account Permissions & Authorization", () => {
    it("allows superAdmin to manage all system resources and accounts", () => {
      expect(hasPermission(systemRoles.superAdmin, "accounts:create")).toBe(true);
      expect(hasPermission(systemRoles.superAdmin, "accounts:update")).toBe(true);
      expect(hasPermission(systemRoles.superAdmin, "accounts:delete")).toBe(true);
    });

    it("rejects viewer role from modifying or deleting accounts", () => {
      expect(hasPermission(systemRoles.viewer, "accounts:delete")).toBe(false);
      expect(hasPermission(systemRoles.viewer, "accounts:create")).toBe(false);
    });
  });
});
