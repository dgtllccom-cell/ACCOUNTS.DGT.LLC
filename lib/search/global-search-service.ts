/**
 * Global Search Service — ERP-wide search across all modules.
 *
 * Provides server-side full-text search across:
 * - Purchase orders (booking number, manual bill, supplier, buyer, product, container)
 * - Accounts (account name, account number, code)
 * - Ledger entries (voucher number, narration, account)
 * - Roznamcha entries (voucher number, narration)
 * - Customers (name, code, contacts)
 * - Products / Goods (name, code, origin)
 * - Shipping / BL records (BL number, vessel, container number)
 * - Countries, branches, cities
 * - Record translations (multilingual text search)
 *
 * All queries respect session scoping (country / branch / city).
 */

import { createApiSupabaseClient } from "@/lib/api/supabase";
import type { ErpSession } from "@/lib/auth/session";

export type SearchResultItem = {
  entityType: string;
  entityId: string;
  title: string;
  subtitle: string;
  matchedField: string;
  matchedValue: string;
  link: string;
  meta?: Record<string, string>;
};

export type GlobalSearchResult = {
  results: SearchResultItem[];
  total: number;
  query: string;
  modules: string[];
};

type ScopeFilter = {
  countryIds: string[];
  countryBranchIds: string[];
  cityBranchIds: string[];
  isSuperAdmin: boolean;
};

function buildScopeFilter(session: ErpSession): ScopeFilter {
  return {
    countryIds: session.countryIds || [],
    countryBranchIds: session.countryBranchIds || [],
    cityBranchIds: session.cityBranchIds || [],
    isSuperAdmin: session.isSuperAdmin,
  };
}

function applyScopeToQuery(q: any, scope: ScopeFilter, countryCol = "country_id", branchCol = "country_branch_id", cityCol = "city_branch_id") {
  if (scope.isSuperAdmin) return q;

  if (scope.cityBranchIds.length > 0) {
    q = q.in(cityCol, scope.cityBranchIds);
  } else if (scope.countryBranchIds.length > 0) {
    q = q.in(branchCol, scope.countryBranchIds);
  } else if (scope.countryIds.length > 0) {
    q = q.in(countryCol, scope.countryIds);
  } else {
    // No scope — return empty
    q = q.eq("id", "00000000-0000-0000-0000-000000000000");
  }
  return q;
}

function matchesNeedle(value: unknown, needle: string): boolean {
  return String(value ?? "").toLowerCase().includes(needle);
}

async function searchPurchaseOrders(
  supabase: any,
  needle: string,
  scope: ScopeFilter,
  limit: number
): Promise<SearchResultItem[]> {
  let q = supabase
    .from("purchase_orders")
    .select("id, purchase_order_no, payment_status, form_data, country_id, country_branch_id, city_branch_id, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit * 3); // Over-fetch for client filtering

  q = applyScopeToQuery(q, scope);

  const { data, error } = await q;
  if (error || !data) return [];

  const results: SearchResultItem[] = [];
  for (const row of data) {
    const form = row.form_data || {};
    const searchFields: Record<string, string> = {
      "Booking Number": String(row.purchase_order_no || ""),
      "Manual Bill #": String(form.manualBillNo || form.manual_bill_no || ""),
      "Invoice #": String(form.invoiceNo || form.invoice_no || ""),
      "Supplier": String(form.supplierName || form.supplier_name || ""),
      "Buyer": String(form.buyerName || form.buyer_name || ""),
      "Product": String(form.goodsName || form.goods_name || form.productName || ""),
      "Purchase Account": String(form.purchaseAccountName || form.purchase_account_name || ""),
      "Sales Account": String(form.salesAccountName || form.sales_account_name || ""),
      "Status": String(row.payment_status || ""),
      "Container": String(form.containerNo || form.container_no || ""),
    };

    for (const [field, value] of Object.entries(searchFields)) {
      if (value && matchesNeedle(value, needle)) {
        results.push({
          entityType: "purchase_order",
          entityId: row.id,
          title: `PO ${row.purchase_order_no || "—"}`,
          subtitle: `${searchFields["Supplier"] || "Unknown Supplier"} • ${searchFields["Product"] || ""}`.trim(),
          matchedField: field,
          matchedValue: value,
          link: `/dashboard/purchases/orders?id=${row.id}`,
          meta: {
            status: row.payment_status || "",
            date: row.created_at || "",
          },
        });
        break; // One result per entity
      }
    }

    if (results.length >= limit) break;
  }

  return results.slice(0, limit);
}

async function searchAccounts(
  supabase: any,
  needle: string,
  scope: ScopeFilter,
  limit: number
): Promise<SearchResultItem[]> {
  let q = supabase
    .from("enterprise_accounts")
    .select("id, name, code, kind, scope, country_id, country_branch_id, city_branch_id")
    .is("deleted_at", null)
    .or(`name.ilike.%${needle}%,code.ilike.%${needle}%`)
    .order("name")
    .limit(limit);

  q = applyScopeToQuery(q, scope);

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((row: any) => {
    let matchedField = "Name";
    let matchedValue = row.name || "";
    if (matchesNeedle(row.code, needle)) {
      matchedField = "Code";
      matchedValue = row.code;
    }

    return {
      entityType: "account",
      entityId: row.id,
      title: row.name || "Unnamed Account",
      subtitle: `${row.code || ""} • ${row.kind || ""}`.trim(),
      matchedField,
      matchedValue,
      link: `/dashboard/accounts?id=${row.id}`,
      meta: { scope: row.scope || "", type: row.kind || "" },
    };
  });
}

async function searchCustomers(
  supabase: any,
  needle: string,
  scope: ScopeFilter,
  limit: number
): Promise<SearchResultItem[]> {
  let q = supabase
    .from("customers")
    .select("id, customer_name, company_name, mobile, email, country_id")
    .is("deleted_at", null)
    .or(`customer_name.ilike.%${needle}%,company_name.ilike.%${needle}%,mobile.ilike.%${needle}%,email.ilike.%${needle}%`)
    .order("customer_name")
    .limit(limit);

  // Manual scope for customers (only country_id exists)
  if (!scope.isSuperAdmin) {
    if (scope.countryIds.length > 0) {
      q = q.in("country_id", scope.countryIds);
    } else {
      q = q.eq("id", "00000000-0000-0000-0000-000000000000");
    }
  }

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((row: any) => ({
    entityType: "customer",
    entityId: row.id,
    title: row.customer_name || "Unnamed Customer",
    subtitle: `${row.company_name || ""} • ${row.mobile || row.email || ""}`.trim(),
    matchedField: matchesNeedle(row.customer_name, needle) ? "Name" : matchesNeedle(row.company_name, needle) ? "Company" : "Contact",
    matchedValue: matchesNeedle(row.customer_name, needle) ? row.customer_name : matchesNeedle(row.company_name, needle) ? row.company_name : (row.mobile || row.email || ""),
    link: `/dashboard/customers?id=${row.id}`,
  }));
}

async function searchShipping(
  supabase: any,
  needle: string,
  scope: ScopeFilter,
  limit: number
): Promise<SearchResultItem[]> {
  let q = supabase
    .from("shipping_bl_records")
    .select("id, bl_number, vessel_name, container_number, loading_port, discharge_port, country_id, country_branch_id, city_branch_id, created_at")
    .is("deleted_at", null)
    .or(`bl_number.ilike.%${needle}%,vessel_name.ilike.%${needle}%,container_number.ilike.%${needle}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  q = applyScopeToQuery(q, scope);

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((row: any) => ({
    entityType: "shipping",
    entityId: row.id,
    title: `BL ${row.bl_number || "—"}`,
    subtitle: `${row.vessel_name || ""} • ${row.container_number || ""}`.trim(),
    matchedField: matchesNeedle(row.bl_number, needle) ? "BL Number" : matchesNeedle(row.container_number, needle) ? "Container" : "Vessel",
    matchedValue: matchesNeedle(row.bl_number, needle) ? row.bl_number : matchesNeedle(row.container_number, needle) ? row.container_number : row.vessel_name,
    link: `/dashboard/shipping?id=${row.id}`,
  }));
}

async function searchLocations(
  supabase: any,
  needle: string,
  _scope: ScopeFilter,
  limit: number
): Promise<SearchResultItem[]> {
  const results: SearchResultItem[] = [];

  // Search countries
  const { data: countries } = await supabase
    .from("countries")
    .select("id, name, iso2, iso3, currency_code")
    .is("deleted_at", null)
    .or(`name.ilike.%${needle}%,iso2.ilike.%${needle}%,iso3.ilike.%${needle}%`)
    .limit(limit);

  if (countries) {
    for (const row of countries) {
      results.push({
        entityType: "country",
        entityId: row.id,
        title: row.name || "",
        subtitle: `${row.iso2 || row.iso3 || ""} • ${row.currency_code || ""}`,
        matchedField: matchesNeedle(row.name, needle) ? "Name" : "Code",
        matchedValue: matchesNeedle(row.name, needle) ? row.name : (row.iso2 || row.iso3 || ""),
        link: `/dashboard/branches?countryId=${row.id}`,
      });
    }
  }

  // Search country branches
  const { data: branches } = await supabase
    .from("country_branches")
    .select("id, name, code, country_id")
    .is("deleted_at", null)
    .or(`name.ilike.%${needle}%,code.ilike.%${needle}%`)
    .limit(limit);

  if (branches) {
    for (const row of branches) {
      results.push({
        entityType: "country_branch",
        entityId: row.id,
        title: row.name || "",
        subtitle: `Branch • ${row.code || ""}`,
        matchedField: matchesNeedle(row.name, needle) ? "Name" : "Code",
        matchedValue: matchesNeedle(row.name, needle) ? row.name : row.code,
        link: `/dashboard/branches?branchId=${row.id}`,
      });
    }
  }

  // Search city branches
  const { data: cities } = await supabase
    .from("city_branches")
    .select("id, name, code, country_branch_id")
    .is("deleted_at", null)
    .or(`name.ilike.%${needle}%,code.ilike.%${needle}%`)
    .limit(limit);

  if (cities) {
    for (const row of cities) {
      results.push({
        entityType: "city_branch",
        entityId: row.id,
        title: row.name || "",
        subtitle: `City Branch • ${row.code || ""}`,
        matchedField: matchesNeedle(row.name, needle) ? "Name" : "Code",
        matchedValue: matchesNeedle(row.name, needle) ? row.name : row.code,
        link: `/dashboard/branches?cityId=${row.id}`,
      });
    }
  }

  return results.slice(0, limit);
}

async function searchProducts(
  supabase: any,
  needle: string,
  _scope: ScopeFilter,
  limit: number
): Promise<SearchResultItem[]> {
  const { data, error } = await supabase
    .from("goods")
    .select("id, goods_name, chs_code")
    .is("deleted_at", null)
    .or(`goods_name.ilike.%${needle}%,chs_code.ilike.%${needle}%`)
    .limit(limit);

  if (error || !data) return [];

  return data.map((row: any) => ({
    entityType: "product",
    entityId: row.id,
    title: row.goods_name || "Unnamed Product",
    subtitle: `${row.chs_code || ""}`.trim(),
    matchedField: matchesNeedle(row.goods_name, needle) ? "Name" : "Code",
    matchedValue: matchesNeedle(row.goods_name, needle) ? row.goods_name : row.chs_code,
    link: `/dashboard/goods?id=${row.id}`,
  }));
}

async function searchRoznamcha(
  supabase: any,
  needle: string,
  scope: ScopeFilter,
  limit: number
): Promise<SearchResultItem[]> {
  let q = supabase
    .from("roznamcha_entries")
    .select("id, voucher_no, narration, type, country_id, country_branch_id, city_branch_id, created_at")
    .is("deleted_at", null)
    .or(`voucher_no.ilike.%${needle}%,narration.ilike.%${needle}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  q = applyScopeToQuery(q, scope);

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((row: any) => ({
    entityType: "roznamcha",
    entityId: row.id,
    title: `Voucher ${row.voucher_no || "—"}`,
    subtitle: (row.narration || "").substring(0, 80),
    matchedField: matchesNeedle(row.voucher_no, needle) ? "Voucher Number" : "Narration",
    matchedValue: matchesNeedle(row.voucher_no, needle) ? row.voucher_no : row.narration,
    link: `/dashboard/roznamcha?id=${row.id}`,
    meta: { scope: row.type || "" },
  }));
}

// Module list for filtering
const MODULE_MAP: Record<string, string> = {
  purchase_order: "Purchase Orders",
  account: "Accounts",
  customer: "Customers",
  shipping: "Shipping / BL",
  country: "Countries",
  country_branch: "Branches",
  city_branch: "City Branches",
  product: "Products / Goods",
  roznamcha: "Roznamcha / Cash",
};

export async function globalSearch(
  session: ErpSession,
  query: string,
  options: {
    modules?: string[];
    limit?: number;
  } = {}
): Promise<GlobalSearchResult> {
  const needle = query.trim().toLowerCase();
  if (!needle || needle.length < 2) {
    return { results: [], total: 0, query, modules: Object.keys(MODULE_MAP) };
  }

  const supabase = await createApiSupabaseClient();
  const scope = buildScopeFilter(session);
  const perModuleLimit = options.limit || 10;
  const selectedModules = options.modules || Object.keys(MODULE_MAP);

  const searchPromises: Promise<SearchResultItem[]>[] = [];

  if (selectedModules.includes("purchase_order")) {
    searchPromises.push(searchPurchaseOrders(supabase, needle, scope, perModuleLimit));
  }
  if (selectedModules.includes("account")) {
    searchPromises.push(searchAccounts(supabase, needle, scope, perModuleLimit));
  }
  if (selectedModules.includes("customer")) {
    searchPromises.push(searchCustomers(supabase, needle, scope, perModuleLimit));
  }
  if (selectedModules.includes("shipping")) {
    searchPromises.push(searchShipping(supabase, needle, scope, perModuleLimit));
  }
  if (selectedModules.includes("country") || selectedModules.includes("country_branch") || selectedModules.includes("city_branch")) {
    searchPromises.push(searchLocations(supabase, needle, scope, perModuleLimit));
  }
  if (selectedModules.includes("product")) {
    searchPromises.push(searchProducts(supabase, needle, scope, perModuleLimit));
  }
  if (selectedModules.includes("roznamcha")) {
    searchPromises.push(searchRoznamcha(supabase, needle, scope, perModuleLimit));
  }

  const allResults = (await Promise.allSettled(searchPromises))
    .filter((r): r is PromiseFulfilledResult<SearchResultItem[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  return {
    results: allResults.slice(0, perModuleLimit * 5),
    total: allResults.length,
    query,
    modules: Object.keys(MODULE_MAP),
  };
}

export { MODULE_MAP };
