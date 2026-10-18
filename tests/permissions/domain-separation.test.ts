import { describe, expect, it } from "vitest";
import { enterpriseRolePermissions, type EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { BUSINESS_ONLY_ROUTE_PREFIXES, ROUTE_PERMISSION_MAP, SHIPPING_ONLY_ROUTE_PREFIXES, evaluateRouteAccess } from "@/lib/navigation/route-policy";
import { visibleMenuHrefsFor } from "@/components/layout/digital-dock-premium-sidebar";
import { cityBranchInDomains } from "@/lib/auth/session";
import { allowedRowDomains, rowInSessionDomain, sessionDomainFilter } from "@/lib/permissions/domain-scope";
import { assignmentBranchDomainError } from "@/lib/permissions/user-management-scope";

type Persona = { name: string; roles: EnterpriseRole[]; domains: ("business" | "shipping" | "both")[]; ledgerVisibility?: "scoped" | "shipping_only" };

const perms = (roles: EnterpriseRole[]) => [...new Set(roles.flatMap((r) => enterpriseRolePermissions[r] ?? []))];
const startsWithAny = (href: string, prefixes: readonly string[]) => {
  const p = href.split("?")[0];
  return prefixes.some((x) => p === x || p.startsWith(x + "/"));
};

const BUSINESS: Persona[] = [
  { name: "Business Super Admin", roles: ["business_super_admin"], domains: ["business"] },
  { name: "Business Country Admin", roles: ["country_admin"], domains: ["business"] },
  { name: "Business Main Branch Admin", roles: ["main_branch_admin"], domains: ["business"] },
  { name: "Business City Branch Admin", roles: ["city_branch_admin"], domains: ["business"] },
  { name: "Business Accountant", roles: ["accountant"], domains: ["business"] },
];
const SHIPPING: Persona[] = [
  { name: "Shipping Super Admin", roles: ["shipping_super_admin"], domains: ["shipping"], ledgerVisibility: "shipping_only" },
  { name: "Shipping Country Admin", roles: ["country_admin"], domains: ["shipping"] },
  { name: "Shipping City Branch Admin (Chaman)", roles: ["city_branch_admin"], domains: ["shipping"] },
  { name: "Shipping Line Admin", roles: ["shipping_line_admin"], domains: ["shipping"], ledgerVisibility: "shipping_only" },
  { name: "Shipping Agent", roles: ["agent_user"], domains: ["shipping"], ledgerVisibility: "shipping_only" },
];

function menu(p: Persona) {
  return visibleMenuHrefsFor(p.roles, perms(p.roles), { operationalDomains: p.domains, ledgerVisibility: p.ledgerVisibility ?? "scoped", canViewFinancials: true });
}
function can(p: Persona, pathname: string) {
  return evaluateRouteAccess({ pathname, permissions: perms(p.roles), roles: p.roles, operationalDomains: p.domains, canViewFinancials: true }).allowed;
}

describe("Business-only logins never see or open the Shipping Line world", () => {
  for (const p of BUSINESS) {
    it(`${p.name}: sidebar has no Shipping Line entry`, () => {
      const leaked = menu(p).filter((h) => startsWithAny(h, SHIPPING_ONLY_ROUTE_PREFIXES));
      expect(leaked).toEqual([]);
    });
    it(`${p.name}: every Shipping Line URL answers 403`, () => {
      for (const prefix of SHIPPING_ONLY_ROUTE_PREFIXES) {
        expect(can(p, prefix), `${p.name} → ${prefix}`).toBe(false);
        expect(can(p, `${prefix}/anything`), `${p.name} → ${prefix}/anything`).toBe(false);
      }
    });
  }
});

describe("Shipping-only logins never see or open the Business world (whatever admin role they hold)", () => {
  for (const p of SHIPPING) {
    it(`${p.name}: sidebar has no Business-only entry`, () => {
      const leaked = menu(p).filter((h) => startsWithAny(h, BUSINESS_ONLY_ROUTE_PREFIXES));
      expect(leaked).toEqual([]);
    });
    it(`${p.name}: every Business-only URL answers 403`, () => {
      for (const prefix of BUSINESS_ONLY_ROUTE_PREFIXES) {
        expect(can(p, prefix), `${p.name} → ${prefix}`).toBe(false);
        expect(can(p, `${prefix}/anything`), `${p.name} → ${prefix}/anything`).toBe(false);
      }
    });
  }
  // Regression: before the sidebar followed the DOMAIN, a Country / Branch Admin in the Shipping domain still received these
  // Business-only entries (banks, tax, goods master, warehouses, Business inter-country transfers, AI/document intake ...).
  const BUSINESS_MENU_ONLY = [
    "/dashboard/settings/bank", "/dashboard/settings/tax", "/dashboard/settings/goods-master", "/dashboard/settings/product-categories",
    "/dashboard/settings/warehouse", "/dashboard/settings/account-type", "/dashboard/roznamcha/reports/bank", "/dashboard/mail-management/users",
    "/dashboard/document-intelligence", "/dashboard/ai-entry/approvals", "/dashboard/inter-country-transfers"
  ];
  for (const p of SHIPPING.filter((x) => x.roles[0] === "country_admin" || x.roles[0] === "city_branch_admin")) {
    it(`${p.name}: none of the Business-only menu entries leak`, () => {
      const m = menu(p).map((h) => h.split("?")[0]);
      const plain = menu(p).filter((h) => h === "/dashboard/inter-country-transfers"); // the bare Business page (the ?category=shipping_line entry is the Shipping one)
      expect(m.filter((h) => BUSINESS_MENU_ONLY.includes(h) && h !== "/dashboard/inter-country-transfers")).toEqual([]);
      expect(plain).toEqual([]);
    });
  }
  it("a Shipping-domain Country Admin gets the Shipping menu, not the whole Country Admin menu", () => {
    const m = menu(SHIPPING[1]);
    expect(m).toContain("/dashboard/logistics");
    expect(m.some((h) => h.startsWith("/dashboard/purchase"))).toBe(false);
    expect(m.some((h) => h.startsWith("/dashboard/sales"))).toBe(false);
    expect(m.some((h) => h.startsWith("/dashboard/inventory"))).toBe(false);
  });
});

describe("a login that really works in both worlds ('both' assignment) keeps both", () => {
  const both: Persona = { name: "Both-domain Country Admin", roles: ["country_admin"], domains: ["both"] };
  it("sees Purchase and the Shipping Line menu", () => {
    const m = menu(both);
    expect(m.some((h) => h.startsWith("/dashboard/purchase"))).toBe(true);
    expect(m.some((h) => h.startsWith("/dashboard/shipping-line") || h.startsWith("/dashboard/clearing-agent"))).toBe(true);
  });
});

describe("domain row helpers", () => {
  const s = (isSuperAdmin: boolean, operationalDomains: any) => ({ isSuperAdmin, operationalDomains });
  it("Global Super Admin and 'both' see every domain; single-domain logins see their own + shared 'both' rows", () => {
    expect(sessionDomainFilter(s(true, ["business"]))).toBeNull();
    expect(sessionDomainFilter(s(false, ["both"]))).toBeNull();
    expect(sessionDomainFilter(s(false, ["business", "shipping"]))).toBeNull();
    expect(sessionDomainFilter(s(false, ["shipping"]))).toBe("shipping");
    expect(allowedRowDomains(s(false, ["business"]))).toEqual(["business", "both"]);
    expect(rowInSessionDomain(s(false, ["business"]), "shipping")).toBe(false);
    expect(rowInSessionDomain(s(false, ["business"]), null)).toBe(true);
    expect(rowInSessionDomain(s(false, ["business"]), "both")).toBe(true);
    expect(rowInSessionDomain(s(false, ["shipping"]), "business")).toBe(false);
    expect(rowInSessionDomain(s(false, ["shipping"]), undefined)).toBe(false);
  });
  it("a downward country grant of one domain never expands into the other domain's branches", () => {
    expect(cityBranchInDomains("shipping", ["business"])).toBe(false);
    expect(cityBranchInDomains("business", ["shipping"])).toBe(false);
    expect(cityBranchInDomains(null, ["business"])).toBe(true);
    expect(cityBranchInDomains("both", ["shipping"])).toBe(true);
    expect(cityBranchInDomains("shipping", ["both"])).toBe(true);
    expect(cityBranchInDomains("shipping", ["business", "shipping"])).toBe(true);
  });
  it("user ↔ branch domain consistency", () => {
    expect(assignmentBranchDomainError("shipping", "business")).toMatch(/Shipping Line user/);
    expect(assignmentBranchDomainError("business", "shipping")).toMatch(/Business user/);
    expect(assignmentBranchDomainError("business", "business")).toBeNull();
    expect(assignmentBranchDomainError("shipping", "shipping")).toBeNull();
    expect(assignmentBranchDomainError("both", "business")).toBeNull();
    expect(assignmentBranchDomainError("business", null)).toBeNull();
    expect(assignmentBranchDomainError("shipping", null)).toMatch(/Shipping Line user/);
  });
});

describe("master rule: ONE granted permission never unlocks a module, country, branch or domain", () => {
  // a login holding exactly one token (no role template, no wildcard) must only be offered / allowed the pages that token maps to
  const TOKENS = ["accounts:read", "ledgers:read", "customers:read", "shipping_records:read", "purchases:read", "users:read", "reports:read", "expenses:read"];
  const grants = (token: string, path: string) => {
    const map = ROUTE_PERMISSION_MAP[path.split("?")[0]];
    if (!map) return false;
    const [resource] = token.split(":");
    return map.some((p) => p === token || p === `${resource}:*`);
  };
  for (const domain of ["business", "shipping"] as const) {
    for (const token of TOKENS) {
      it(`${domain} login holding only ${token}: every menu entry is mapped to that token`, () => {
        const hrefs = visibleMenuHrefsFor(["staff_user"], [token], { operationalDomains: [domain], canViewFinancials: true });
        const stray = hrefs.filter((h) => h.split("?")[0] !== "/dashboard" && !grants(token, h));
        expect(stray, `${domain}/${token} also got ${stray.join(", ")}`).toEqual([]);
      });
    }
  }
  it("one token never crosses the domain: purchases:read in the Shipping domain opens no Purchase page, shipping_records:read in the Business domain opens no Shipping page", () => {
    const can = (token: string, domain: "business" | "shipping", path: string) =>
      evaluateRouteAccess({ pathname: path, permissions: [token], roles: ["staff_user"], operationalDomains: [domain], canViewFinancials: true }).allowed;
    expect(can("purchases:read", "shipping", "/dashboard/purchase/new-purchase-booking-order")).toBe(false);
    expect(can("shipping_records:read", "business", "/dashboard/logistics")).toBe(false);
    expect(can("shipping_records:read", "shipping", "/dashboard/logistics")).toBe(true);
    expect(can("purchases:read", "business", "/dashboard/purchase/new-purchase-booking-order")).toBe(true);
  });
});
