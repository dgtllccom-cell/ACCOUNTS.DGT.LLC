"use client";

import { useEffect } from "react";

const PROTOTYPE = process.env.NEXT_PUBLIC_DGT_PROTOTYPE_MODE === "1";

const countries = [
  { id: "ae", name: "United Arab Emirates", country_name: "United Arab Emirates", iso2: "AE", code: "AE", currency_code: "AED" },
  { id: "pk", name: "Pakistan", country_name: "Pakistan", iso2: "PK", code: "PK", currency_code: "PKR" },
];
const branches = [
  { id: "al-ras", name: "Al Ras Business Branch", cityName: "Dubai", countryId: "ae", operationalDomain: "business", status: "active" },
  { id: "quetta", name: "Quetta Business Branch", cityName: "Quetta", countryId: "pk", operationalDomain: "business", status: "active" },
  { id: "chaman", name: "Chaman Shipping Line Branch", cityName: "Chaman", countryId: "pk", operationalDomain: "shipping", status: "active" },
];
const goods = [
  { id: "g-almond", goodsName: "Almond Kernel", goods_name: "Almond Kernel", name: "Almond Kernel", hsCode: "080212", hs_code: "080212", variations: [{ id: "gv-1", size: "23/25", brand: "DGT", variety: "Premium" }] },
  { id: "g-pistachio", goodsName: "Pistachio Kernel", goods_name: "Pistachio Kernel", name: "Pistachio Kernel", hsCode: "080252", hs_code: "080252", variations: [{ id: "gv-2", size: "Whole", brand: "DGT", variety: "Premium" }] },
];
const users = [
  { id: "proto-admin", name: "Prototype Super Admin", fullName: "Prototype Super Admin", username: "prototype.admin", loginId: "prototype.admin", email: "prototype@dgt.local", role: "super_admin", status: "Active" },
];
const accounts = [
  { id: "acc-purchase", accountName: "Prototype Purchase Account", account_name: "Prototype Purchase Account", name: "Prototype Purchase Account", currency: "AED", currencyCode: "AED", status: "active" },
  { id: "acc-sales", accountName: "Prototype Sales Account", account_name: "Prototype Sales Account", name: "Prototype Sales Account", currency: "AED", currencyCode: "AED", status: "active" },
];

function genericData() {
  return {
    rows: [], records: [], items: [], entries: [], results: [], data: [],
    users: [], accounts: [], ledgers: [], customers: [], companies: [], goods: [],
    countries: [], branches: [], cityBranches: [], countryBranches: [], warehouses: [],
    banks: [], shippingLines: [], clearingAgents: [], invoices: [], orders: [],
    total: 0, count: 0, limit: 100, page: 1,
  };
}

function payloadFor(url: string, method: string) {
  const u = url.toLowerCase();
  const session = {
    userId: "00000000-0000-4000-8000-000000000001",
    email: "prototype@dgt.local",
    fullName: "DGT ERP Prototype",
    roles: ["super_admin"],
    permissions: ["*:*"],
    isSuperAdmin: true,
    preferredLanguage: "en",
    operationalDomains: ["business", "shipping"],
    ledgerVisibility: "full",
    canViewFinancials: true,
  };

  if (u.includes("/auth/session")) return session;
  if (u.includes("/users/login-management")) return {
    superAdminBranches: [{ name: "DGT Prototype", users }],
    countries: [
      { name: "United Arab Emirates", mainBranches: [{ name: "UAE Main Branch", users: [], cityBranches: [{ name: "Al Ras Business Branch", cityName: "Dubai", users }] }] },
      { name: "Pakistan", mainBranches: [{ name: "Pakistan Main Branch", users: [], cityBranches: [{ name: "Quetta Business Branch", cityName: "Quetta", users: [] }, { name: "Chaman Shipping Line Branch", cityName: "Chaman", users: [] }] }] },
    ],
  };
  if (u.includes("/locations/countries") || /\/countries(\?|$)/.test(u)) return { countries, items: countries, rows: countries };
  if (u.includes("/city-branches") || u.includes("/branches")) return { branches, cityBranches: branches, rows: branches, items: branches };
  if (u.includes("/goods")) return { goods, items: goods, rows: goods };
  if (u.includes("/accounts") || u.includes("/ledgers")) return { accounts, ledgers: accounts, items: accounts, rows: accounts };
  if (u.includes("/customers")) return { customers: [{ id: "cust-1", name: "Prototype Customer", companyName: "Prototype Customer" }], items: [] };
  if (u.includes("/companies")) return { companies: [{ id: "co-1", name: "Daman General Trading LLC", companyName: "Daman General Trading LLC" }], items: [] };
  if (u.includes("/warehouses")) return { warehouses: [{ id: "wh-1", name: "Al Ras Warehouse" }], items: [] };
  if (u.includes("/banks")) return { banks: [{ id: "bank-1", name: "Prototype Bank", bankName: "Prototype Bank" }], items: [] };
  if (u.includes("/shipping-lines")) return { shippingLines: [{ id: "sl-1", name: "Prototype Shipping Line" }], items: [] };
  if (u.includes("/clearing-agents")) return { clearingAgents: [{ id: "ca-1", name: "Prototype Clearing Agent" }], items: [] };

  // Prototype writes always succeed in-memory and never reach any API/database.
  if (method !== "GET") return { success: true, prototype: true, id: "prototype-no-write", ...genericData() };
  return genericData();
}

function toResponse(data: any) {
  // Include both raw and standard ERP envelope so direct fetch() and apiFetch()
  // callers can consume the same prototype response safely.
  const body = data && typeof data === "object" ? { ...data, ok: true, data } : { ok: true, data };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", "x-dgt-prototype": "1" },
  });
}

export function PrototypeNetworkGuard() {
  useEffect(() => {
    if (!PROTOTYPE) return;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      let parsed: URL | null = null;
      try { parsed = new URL(raw, window.location.origin); } catch {}
      const method = String(init?.method || (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();

      if (parsed && parsed.origin === window.location.origin && (parsed.pathname.startsWith("/api/") || parsed.pathname.startsWith("/mail/api/"))) {
        return toResponse(payloadFor(parsed.pathname + parsed.search, method));
      }

      // Prototype must not call external services.
      if (parsed && parsed.origin !== window.location.origin) {
        return toResponse({ success: true, prototype: true, blockedExternalRequest: true });
      }

      return originalFetch(input, init);
    };

    document.documentElement.dataset.dgtPrototype = "true";
    return () => {
      window.fetch = originalFetch;
      delete document.documentElement.dataset.dgtPrototype;
    };
  }, []);

  if (!PROTOTYPE) return null;
  return (
    <div
      aria-label="Design-only prototype"
      className="fixed bottom-2 right-2 z-[99999] rounded-full border border-emerald-300 bg-emerald-50/95 px-3 py-1 text-[10px] font-bold text-emerald-800 shadow-sm backdrop-blur dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300"
    >
      DESIGN-ONLY PROTOTYPE • NO LIVE WRITES
    </div>
  );
}
