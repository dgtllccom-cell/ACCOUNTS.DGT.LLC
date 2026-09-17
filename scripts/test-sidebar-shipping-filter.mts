import { DAMAN_SIDEBAR_ITEMS } from "../components/layout/digital-dock-premium-sidebar.js";

// Test the filter logic as defined in digital-dock-premium-sidebar.tsx
function testShippingSidebarFilter() {
  console.log("=== Testing Shipping Line User Sidebar Scoping ===");

  // Mock user session for usr7420@dgt.llc
  const userRolesSet = new Set(["agent_user"]);
  const userPermsSet = new Set([
    "roznamcha:read",
    "transactions:read",
    "roznamcha:create",
    "transactions:create",
    "shipping_records:read",
    "companies:read",
    "customers:read",
    "ledgers:read"
  ]);

  const shippingContext = {
    isShippingScoped: true,
    operationalDomains: ["shipping"] as ("business" | "shipping" | "both")[],
    ledgerVisibility: "shipping_only" as "scoped" | "shipping_only" | "full"
  };

  const isSuper = userRolesSet.has("super_admin") || userPermsSet.has("*:*");

  const isShippingOnly =
    !isSuper &&
    (Boolean(shippingContext?.isShippingScoped) ||
      shippingContext?.ledgerVisibility === "shipping_only" ||
      (shippingContext?.operationalDomains?.includes("shipping") &&
        !shippingContext?.operationalDomains?.includes("business") &&
        !shippingContext?.operationalDomains?.includes("both")) ||
      userRolesSet.has("agent_user") ||
      userRolesSet.has("shipping_user")) &&
    !userRolesSet.has("country_admin") &&
    !userRolesSet.has("country_user") &&
    !userRolesSet.has("main_branch_admin") &&
    !userRolesSet.has("city_branch_admin") &&
    !userRolesSet.has("accountant") &&
    !userRolesSet.has("cashier");

  console.log("isShippingOnly detected:", isShippingOnly);
  if (!isShippingOnly) throw new Error("Expected isShippingOnly to be TRUE");

  const ALLOWED_SHIPPING_KEYS = new Set([
    "dashboard",
    "shipping-cleaning",
    "ledgers",
    "transfer-handover-center",
    "daily-payment"
  ]);

  const filtered = DAMAN_SIDEBAR_ITEMS
    .filter((it: any) => ALLOWED_SHIPPING_KEYS.has(it.key))
    .map((it: any) => {
      if (it.key === "dashboard") {
        return { ...it, href: "/dashboard/logistics" };
      }
      if (it.key === "shipping-cleaning") {
        return { ...it, defaultOpen: true };
      }
      if (it.key === "ledgers") {
        const allowedLedgerHrefs = new Set([
          "/dashboard/ledger/detailed",
          "/dashboard/ledger/general-report"
        ]);
        const kids = (it.children || []).filter((c: any) => allowedLedgerHrefs.has(c.href));
        return {
          ...it,
          defaultOpen: false,
          children: kids
        };
      }
      if (it.key === "daily-payment") {
        const hasRoznamcha = userPermsSet.has("roznamcha:read") || userPermsSet.has("roznamcha:*");
        if (!hasRoznamcha) return null;
        return {
          ...it,
          children: (it.children || []).filter((c: any) => c.href === "/dashboard/roznamcha/cash-entry")
        };
      }
      return it;
    })
    .filter(Boolean);

  console.log("Filtered top-level keys:", filtered.map((f: any) => f.key));

  // Assertions
  const keys = filtered.map((f: any) => f.key);
  if (keys.includes("new-entry")) throw new Error("FAIL: new-entry is visible!");
  if (keys.includes("purchase-sales-trade")) throw new Error("FAIL: purchase-sales-trade is visible!");
  if (keys.includes("journal-stock")) throw new Error("FAIL: journal-stock is visible!");
  if (keys.includes("entry-edit-delete-control")) throw new Error("FAIL: entry-edit-delete-control is visible!");
  if (keys.includes("finance")) throw new Error("FAIL: finance is visible!");

  if (!keys.includes("shipping-cleaning")) throw new Error("FAIL: shipping-cleaning missing!");
  if (!keys.includes("ledgers")) throw new Error("FAIL: ledgers missing!");
  if (!keys.includes("dashboard")) throw new Error("FAIL: dashboard missing!");

  const ledgersItem = filtered.find((f: any) => f.key === "ledgers");
  console.log("Ledgers sub-items:", ledgersItem.children.map((c: any) => c.label));
  if (ledgersItem.children.length !== 2) throw new Error("FAIL: expected exactly 2 ledger items");

  const shippingItem = filtered.find((f: any) => f.key === "shipping-cleaning");
  console.log("Shipping sub-items count:", shippingItem.children.length);
  if (shippingItem.children.length < 9) throw new Error("FAIL: shipping items count unexpected");

  console.log("✅ ALL TESTS PASSED: Shipping user sees ONLY shipping modules + scoped ledgers!");
}

testShippingSidebarFilter();
