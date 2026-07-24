"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, CircleDollarSign, Filter, PackageCheck, PackageX, RefreshCw, Search, Tags, WalletCards } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ProductRow = {
  id: string;
  product_code: string;
  sku: string | null;
  country_id: string;
  country_branch_id: string | null;
  city_branch_id: string | null;
  product_name: string;
  product_specifications: Record<string, unknown> | null;
  is_active: boolean;
  translated_name: string | null;
  translated_category: string | null;
  translated_brand: string | null;
  category_name: string | null;
  brand_name: string | null;
  unit_code: string | null;
  unit_name: string | null;
};

type ProductsResponse = {
  products: ProductRow[];
  generatedAt?: string;
};

type AccountReportResponse = {
  summary: {
    totalAccounts: number;
    activeAccounts: number;
    currentBalanceTotal: number;
  };
};

type BranchHierarchyResponse = {
  countries: Array<{
    id: string;
    name: string;
    code: string;
    currency: string;
    mainBranches: Array<{
      id: string;
      name: string;
      code: string;
      cityBranches: Array<{
        id: string;
        name: string;
        cityName: string;
        code: string;
      }>;
    }>;
  }>;
};

type BranchLookup = {
  countries: Map<string, { name: string; code: string; currency: string }>;
  mainBranches: Map<string, { name: string; code: string }>;
  cityBranches: Map<string, { name: string; code: string }>;
};

const emptyBranchLookup: BranchLookup = {
  countries: new Map(),
  mainBranches: new Map(),
  cityBranches: new Map()
};

function asNumber(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function specNumber(spec: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!spec) return 0;
  for (const key of keys) {
    if (spec[key] !== undefined && spec[key] !== null && spec[key] !== "") return asNumber(spec[key]);
  }
  return 0;
}

function normalized(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function formatNumber(value: number, decimals = 0) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function productName(row: ProductRow) {
  return row.translated_name || row.product_name || "-";
}

function productCategory(row: ProductRow) {
  return row.translated_category || row.category_name || "Uncategorized";
}

function productUnit(row: ProductRow) {
  return row.unit_code || row.unit_name || String(row.product_specifications?.unit ?? "Unit");
}

function stockQty(row: ProductRow) {
  return specNumber(row.product_specifications, ["stockQty", "stock_qty", "quantity", "qty"]);
}

function costPrice(row: ProductRow) {
  return specNumber(row.product_specifications, ["costPrice", "cost_price", "purchaseRate", "purchase_rate"]);
}

function salePrice(row: ProductRow) {
  return specNumber(row.product_specifications, ["salePrice", "sale_price", "sellingPrice", "selling_price"]);
}

function inventoryValue(row: ProductRow) {
  const explicit = specNumber(row.product_specifications, ["inventoryValue", "inventory_value"]);
  return explicit || stockQty(row) * costPrice(row);
}

function buildLookup(response: BranchHierarchyResponse | null): BranchLookup {
  if (!response) return emptyBranchLookup;
  const countries = new Map<string, { name: string; code: string; currency: string }>();
  const mainBranches = new Map<string, { name: string; code: string }>();
  const cityBranches = new Map<string, { name: string; code: string }>();

  for (const country of response.countries ?? []) {
    countries.set(country.id, { name: country.name, code: country.code, currency: country.currency });
    for (const branch of country.mainBranches ?? []) {
      mainBranches.set(branch.id, { name: branch.name, code: branch.code });
      for (const cityBranch of branch.cityBranches ?? []) {
        cityBranches.set(cityBranch.id, { name: cityBranch.name || cityBranch.cityName, code: cityBranch.code });
      }
    }
  }

  return { countries, mainBranches, cityBranches };
}

function StatCard({
  title,
  value,
  icon,
  tone
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: "green" | "red" | "blue" | "amber";
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "grid h-10 w-10 place-items-center rounded-md border",
            tone === "green" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
            tone === "red" && "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
            tone === "amber" && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
            (!tone || tone === "blue") && "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300"
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="truncate text-xl font-semibold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CountryProductsDashboard() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [accountSummary, setAccountSummary] = useState<AccountReportResponse["summary"] | null>(null);
  const [lookup, setLookup] = useState<BranchLookup>(emptyBranchLookup);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const [productData, accountData, hierarchyData] = await Promise.all([
        apiGet<ProductsResponse>("/api/erp/products?limit=500"),
        apiGet<AccountReportResponse>("/api/erp/accounting/reports/accounts/general?limit=500"),
        apiGet<BranchHierarchyResponse>("/api/branch-management/general-report")
      ]);
      setProducts(productData.products ?? []);
      setAccountSummary(accountData.summary);
      setLookup(buildLookup(hierarchyData));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load country dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const categories = useMemo(() => {
    return [...new Set(products.map(productCategory).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = normalized(search);
    return products.filter((row) => {
      const country = lookup.countries.get(row.country_id)?.name ?? "";
      const mainBranch = row.country_branch_id ? lookup.mainBranches.get(row.country_branch_id)?.name ?? "" : "";
      const cityBranch = row.city_branch_id ? lookup.cityBranches.get(row.city_branch_id)?.name ?? "" : "";
      const text = normalized(
        [
          row.product_code,
          productName(row),
          productCategory(row),
          row.translated_brand,
          row.brand_name,
          country,
          mainBranch,
          cityBranch,
          row.is_active ? "active" : "inactive"
        ]
          .filter(Boolean)
          .join(" ")
      );
      if (q && !text.includes(q)) return false;
      if (categoryFilter !== "all" && productCategory(row) !== categoryFilter) return false;
      if (statusFilter === "active" && !row.is_active) return false;
      if (statusFilter === "inactive" && row.is_active) return false;
      return true;
    });
  }, [categoryFilter, lookup, products, search, statusFilter]);

  const summary = useMemo(() => {
    const totalStock = filteredProducts.reduce((sum, row) => sum + stockQty(row), 0);
    const totalValue = filteredProducts.reduce((sum, row) => sum + inventoryValue(row), 0);
    return {
      totalProducts: filteredProducts.length,
      activeProducts: filteredProducts.filter((row) => row.is_active).length,
      inactiveProducts: filteredProducts.filter((row) => !row.is_active).length,
      productCategories: new Set(filteredProducts.map(productCategory)).size,
      totalStock,
      inventoryValue: totalValue,
      lowStockProducts: filteredProducts.filter((row) => stockQty(row) > 0 && stockQty(row) <= 10).length,
      topSellingProducts: filteredProducts.filter((row) => salePrice(row) > 0).length
    };
  }, [filteredProducts]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Country Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Country-scoped accounts, products, inventory value, and branch product reporting.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadDashboard()} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void loadDashboard()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Accounts" value={accountSummary?.totalAccounts ?? 0} icon={<WalletCards className="h-5 w-5" />} />
        <StatCard title="Total Products" value={summary.totalProducts} icon={<Boxes className="h-5 w-5" />} />
        <StatCard title="Active Products" value={summary.activeProducts} icon={<PackageCheck className="h-5 w-5" />} tone="green" />
        <StatCard title="Inactive Products" value={summary.inactiveProducts} icon={<PackageX className="h-5 w-5" />} tone="red" />
        <StatCard title="Product Categories" value={summary.productCategories} icon={<Tags className="h-5 w-5" />} tone="amber" />
        <StatCard title="Total Stock" value={formatNumber(summary.totalStock)} icon={<Boxes className="h-5 w-5" />} />
        <StatCard title="Inventory Value" value={formatNumber(summary.inventoryValue, 2)} icon={<CircleDollarSign className="h-5 w-5" />} tone="green" />
        <StatCard title="Low Stock Products" value={summary.lowStockProducts} icon={<PackageX className="h-5 w-5" />} tone="amber" />
      </div>

      <Card>
        <CardHeader className="border-b p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle className="text-base">Country Product & Account Report</CardTitle>
              <p className="text-xs text-muted-foreground">
                Products are shown according to country, branch, and user permissions.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-[11px]">Product Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-9 pl-8"
                    placeholder="Name, code, branch..."
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Product Category</Label>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Product Status</Label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-auto h-9"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("all");
                  setStatusFilter("all");
                }}
              >
                <Filter className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-sm">
              <thead className="bg-slate-950 text-xs uppercase tracking-wide text-white dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-3 text-left">Product Code</th>
                  <th className="px-3 py-3 text-left">Product Name</th>
                  <th className="px-3 py-3 text-left">Category</th>
                  <th className="px-3 py-3 text-left">Country</th>
                  <th className="px-3 py-3 text-left">Main Branch</th>
                  <th className="px-3 py-3 text-left">City Branch</th>
                  <th className="px-3 py-3 text-right">Stock Qty</th>
                  <th className="px-3 py-3 text-left">Unit</th>
                  <th className="px-3 py-3 text-right">Cost Price</th>
                  <th className="px-3 py-3 text-right">Sale Price</th>
                  <th className="px-3 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">
                      Loading products and account report...
                    </td>
                  </tr>
                ) : filteredProducts.length ? (
                  filteredProducts.map((row) => {
                    const country = lookup.countries.get(row.country_id);
                    const mainBranch = row.country_branch_id ? lookup.mainBranches.get(row.country_branch_id) : null;
                    const cityBranch = row.city_branch_id ? lookup.cityBranches.get(row.city_branch_id) : null;
                    const currency = country?.currency || String(row.product_specifications?.currency ?? "");
                    return (
                      <tr key={row.id} className="border-b transition-colors hover:bg-muted/40">
                        <td className="px-3 py-3 font-medium">{row.product_code}</td>
                        <td className="px-3 py-3">{productName(row)}</td>
                        <td className="px-3 py-3">{productCategory(row)}</td>
                        <td className="px-3 py-3">{country?.name ?? "-"}</td>
                        <td className="px-3 py-3">{mainBranch?.name ?? "-"}</td>
                        <td className="px-3 py-3">{cityBranch?.name ?? "-"}</td>
                        <td className="px-3 py-3 text-right">{formatNumber(stockQty(row))}</td>
                        <td className="px-3 py-3">{productUnit(row)}</td>
                        <td className="px-3 py-3 text-right">
                          {formatNumber(costPrice(row), 2)} {currency}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatNumber(salePrice(row), 2)} {currency}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                              row.is_active
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                            )}
                          >
                            {row.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">
                      No product records found for this country scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
