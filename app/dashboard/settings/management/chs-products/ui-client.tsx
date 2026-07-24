"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Package, RefreshCw, Save, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiGet, apiPost } from "@/lib/api/client";
import { listCities, listCountries, listStates, type LocationCity, type LocationCountry, type LocationState } from "@/features/locations/location-api";

type SessionLike = {
  preferredLanguage?: string | null;
};

type BranchRow = {
  id: string;
  country_id: string;
  country_branch_id?: string | null;
  name: string;
  code: string;
  local_currency?: string | null;
  status?: string | null;
};

type ProductRow = {
  id: string;
  product_code: string;
  sku: string | null;
  product_name: string;
  translated_name: string | null;
  translated_category: string | null;
  translated_brand: string | null;
  country_id: string;
  state_province_id: string | null;
  city_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  hs_code: string | null;
  size: string | null;
  is_active: boolean;
  created_at: string;
};

type ProductListResponse = {
  products: ProductRow[];
  limit: number;
  languageCode: string;
};

type Banner = { type: "success" | "error"; text: string } | null;

const emptyForm = {
  countryId: "",
  stateProvinceId: "",
  cityId: "",
  countryBranchId: "",
  cityBranchId: "",
  productCode: "",
  sku: "",
  productName: "",
  productDescription: "",
  productCategory: "",
  productBrand: "",
  productSpecifications: "",
  hsCode: "",
  size: "",
  originalLanguage: "en"
};

function nextProductCode() {
  const stamp = new Date();
  const date = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, "0")}${String(stamp.getDate()).padStart(2, "0")}`;
  return `PRD-${date}-${String(stamp.getTime()).slice(-5)}`;
}

function selectClass() {
  return "h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary disabled:opacity-60";
}

function inputClass() {
  return "h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary";
}

function textAreaClass() {
  return "min-h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary";
}

function readName(map: Map<string, string>, id?: string | null) {
  if (!id) return "-";
  return map.get(id) ?? "-";
}

export default function ProductMasterClient({ session }: { session: SessionLike }) {
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [states, setStates] = useState<LocationState[]>([]);
  const [cities, setCities] = useState<LocationCity[]>([]);
  const [countryBranches, setCountryBranches] = useState<BranchRow[]>([]);
  const [cityBranches, setCityBranches] = useState<BranchRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [form, setForm] = useState({ ...emptyForm, productCode: nextProductCode(), originalLanguage: session.preferredLanguage ?? "en" });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  const countryNameById = useMemo(() => new Map(countries.map((row) => [row.id, `${row.name} (${row.currency_code})`])), [countries]);
  const stateNameById = useMemo(() => new Map(states.map((row) => [row.id, row.name])), [states]);
  const cityNameById = useMemo(() => new Map(cities.map((row) => [row.id, row.name])), [cities]);
  const countryBranchNameById = useMemo(() => new Map(countryBranches.map((row) => [row.id, `${row.name} (${row.code})`])), [countryBranches]);
  const cityBranchNameById = useMemo(() => new Map(cityBranches.map((row) => [row.id, `${row.name} (${row.code})`])), [cityBranches]);

  function updateForm(patch: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function refreshProducts(nextQ = q) {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams();
      if (nextQ.trim()) params.set("q", nextQ.trim());
      if (form.countryId) params.set("countryId", form.countryId);
      if (form.stateProvinceId) params.set("stateProvinceId", form.stateProvinceId);
      if (form.cityId) params.set("cityId", form.cityId);
      if (form.countryBranchId) params.set("countryBranchId", form.countryBranchId);
      if (form.cityBranchId) params.set("cityBranchId", form.cityBranchId);
      params.set("limit", "200");
      params.set("lang", form.originalLanguage || "en");
      const result = await apiGet<ProductListResponse>(`/api/erp/products?${params.toString()}`);
      setProducts(result.products ?? []);
    } catch (error: any) {
      setBanner({ type: "error", text: error?.message ?? "Product register could not be loaded." });
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    listCountries()
      .then(setCountries)
      .catch((error: any) => setBanner({ type: "error", text: error?.message ?? "Countries could not be loaded." }));
  }, []);

  useEffect(() => {
    if (!form.countryId) {
      setStates([]);
      setCities([]);
      setCountryBranches([]);
      setCityBranches([]);
      return;
    }

    updateForm({ stateProvinceId: "", cityId: "", countryBranchId: "", cityBranchId: "" });

    Promise.all([
      listStates({ countryId: form.countryId }),
      fetch(`/api/branch-management/country-branches?countryId=${encodeURIComponent(form.countryId)}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((json) => (Array.isArray(json.countryBranches) ? json.countryBranches : []))
    ])
      .then(([nextStates, nextBranches]) => {
        setStates(nextStates);
        setCountryBranches(nextBranches);
      })
      .catch((error: any) => setBanner({ type: "error", text: error?.message ?? "Country data could not be loaded." }));
  }, [form.countryId]);

  useEffect(() => {
    if (!form.countryId) return;
    listCities({ countryId: form.countryId, stateProvinceId: form.stateProvinceId || null })
      .then(setCities)
      .catch((error: any) => setBanner({ type: "error", text: error?.message ?? "Cities could not be loaded." }));
  }, [form.countryId, form.stateProvinceId]);

  useEffect(() => {
    if (!form.countryId || !form.countryBranchId) {
      setCityBranches([]);
      return;
    }

    fetch(
      `/api/branch-management/city-branches?countryId=${encodeURIComponent(form.countryId)}&countryBranchId=${encodeURIComponent(
        form.countryBranchId
      )}`,
      { cache: "no-store" }
    )
      .then((res) => res.json())
      .then((json) => setCityBranches(Array.isArray(json.cityBranches) ? json.cityBranches : []))
      .catch((error: any) => setBanner({ type: "error", text: error?.message ?? "City branches could not be loaded." }));
  }, [form.countryId, form.countryBranchId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshProducts(q);
    }, 220);
    return () => clearTimeout(timer);
  }, [q, form.countryId, form.stateProvinceId, form.cityId, form.countryBranchId, form.cityBranchId, form.originalLanguage]);

  async function saveProduct() {
    if (!form.countryId || !form.productCode.trim() || !form.productName.trim()) {
      setBanner({ type: "error", text: "Country, Product Code, and Product Name are required." });
      return;
    }

    setBusy(true);
    setBanner(null);
    try {
      const specifications: Record<string, unknown> = {};
      if (form.productCategory.trim()) specifications.category = form.productCategory.trim();
      if (form.productBrand.trim()) specifications.brand = form.productBrand.trim();
      if (form.productSpecifications.trim()) specifications.details = form.productSpecifications.trim();

      await apiPost<{ productId: string }>("/api/erp/products", {
        countryId: form.countryId,
        stateProvinceId: form.stateProvinceId || null,
        cityId: form.cityId || null,
        countryBranchId: form.countryBranchId || null,
        cityBranchId: form.cityBranchId || null,
        categoryId: null,
        brandId: null,
        unitId: null,
        productCode: form.productCode.trim(),
        sku: form.sku.trim() || null,
        productName: form.productName.trim(),
        productDescription: form.productDescription.trim() || null,
        productSpecifications: specifications,
        hsCode: form.hsCode.trim() || null,
        size: form.size.trim() || null,
        originCountryId: form.countryId,
        imageUrl: null,
        originalLanguage: form.originalLanguage || "en",
        translations: []
      });

      setBanner({ type: "success", text: "Product saved successfully and added to Product Master Register." });
      setForm((current) => ({
        ...emptyForm,
        countryId: current.countryId,
        stateProvinceId: current.stateProvinceId,
        cityId: current.cityId,
        countryBranchId: current.countryBranchId,
        cityBranchId: current.cityBranchId,
        originalLanguage: current.originalLanguage,
        productCode: nextProductCode()
      }));
      await refreshProducts(q);
    } catch (error: any) {
      setBanner({ type: "error", text: error?.message ?? "Product could not be saved." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Settings / Management</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">CHS Product Management</h1>
          <p className="text-sm text-muted-foreground">
            Centralized Product Master connected with country, state, city, branch, warehouse, purchase, sales, and inventory workflows.
          </p>
        </div>
        <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={() => void refreshProducts(q)} disabled={loadingProducts}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {banner ? (
        <div
          className={`flex items-center justify-between rounded-lg border p-3 text-sm ${
            banner.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-rose-500/30 bg-rose-500/10 text-rose-700"
          }`}
        >
          <span>{banner.text}</span>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setBanner(null)} aria-label="Close message">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 border-b pb-3">
              <Package className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-semibold">New Product Entry</div>
                <div className="text-xs text-muted-foreground">Fill product identity and hierarchy mapping.</div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Country *</span>
                <select
                  value={form.countryId}
                  onChange={(event) => updateForm({ countryId: event.target.value })}
                  className={selectClass()}
                >
                  <option value="">Select Country</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name} ({country.currency_code})
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted-foreground">State / Province</span>
                <select
                  value={form.stateProvinceId}
                  onChange={(event) => updateForm({ stateProvinceId: event.target.value, cityId: "" })}
                  className={selectClass()}
                  disabled={!form.countryId}
                >
                  <option value="">All / None</option>
                  {states.map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted-foreground">City</span>
                <select value={form.cityId} onChange={(event) => updateForm({ cityId: event.target.value })} className={selectClass()} disabled={!form.countryId}>
                  <option value="">All / None</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Main Branch</span>
                <select
                  value={form.countryBranchId}
                  onChange={(event) => updateForm({ countryBranchId: event.target.value, cityBranchId: "" })}
                  className={selectClass()}
                  disabled={!form.countryId}
                >
                  <option value="">Select Main Branch</option>
                  {countryBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted-foreground">City Branch</span>
                <select
                  value={form.cityBranchId}
                  onChange={(event) => updateForm({ cityBranchId: event.target.value })}
                  className={selectClass()}
                  disabled={!form.countryBranchId}
                >
                  <option value="">Select City Branch</option>
                  {cityBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Language</span>
                <select value={form.originalLanguage} onChange={(event) => updateForm({ originalLanguage: event.target.value })} className={selectClass()}>
                  <option value="en">English</option>
                  <option value="ur">Urdu</option>
                  <option value="ps">Pashto</option>
                  <option value="ar">Arabic</option>
                  <option value="fa">Persian / Dari</option>
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Product Code *</span>
                <input value={form.productCode} onChange={(event) => updateForm({ productCode: event.target.value })} className={inputClass()} />
              </label>

              <label className="grid gap-1 lg:col-span-2">
                <span className="text-xs font-semibold text-muted-foreground">Product Name *</span>
                <input
                  value={form.productName}
                  onChange={(event) => updateForm({ productName: event.target.value })}
                  className={inputClass()}
                  placeholder="e.g. Chocolate, Biscuits, Dry Fruits, FMCG Product"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted-foreground">SKU</span>
                <input value={form.sku} onChange={(event) => updateForm({ sku: event.target.value })} className={inputClass()} placeholder="Optional SKU" />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Category</span>
                <input
                  value={form.productCategory}
                  onChange={(event) => updateForm({ productCategory: event.target.value })}
                  className={inputClass()}
                  placeholder="Food Products"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Brand</span>
                <input value={form.productBrand} onChange={(event) => updateForm({ productBrand: event.target.value })} className={inputClass()} placeholder="Brand name" />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted-foreground">HS Code</span>
                <input value={form.hsCode} onChange={(event) => updateForm({ hsCode: event.target.value })} className={inputClass()} placeholder="Optional" />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Size / Packing</span>
                <input value={form.size} onChange={(event) => updateForm({ size: event.target.value })} className={inputClass()} placeholder="500 Boxes / 20 KG" />
              </label>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Description</span>
                <textarea
                  value={form.productDescription}
                  onChange={(event) => updateForm({ productDescription: event.target.value })}
                  className={textAreaClass()}
                  placeholder="Product description for reports, invoices, and inventory."
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Specifications</span>
                <textarea
                  value={form.productSpecifications}
                  onChange={(event) => updateForm({ productSpecifications: event.target.value })}
                  className={textAreaClass()}
                  placeholder="Product specifications, grade, packing, quality, or notes."
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end border-t pt-3">
              <Button type="button" className="h-10 rounded-lg px-5 font-semibold" onClick={saveProduct} disabled={busy}>
                <Save className="mr-2 h-4 w-4" />
                {busy ? "Saving..." : "Save Product"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="mb-3 border-b pb-3">
              <div className="text-sm font-semibold">Live Product Preview</div>
              <div className="text-xs text-muted-foreground">This is how the product will be linked in ERP hierarchy.</div>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ["Product Code", form.productCode || "-"],
                ["Product Name", form.productName || "-"],
                ["Country", readName(countryNameById, form.countryId)],
                ["State / Province", readName(stateNameById, form.stateProvinceId)],
                ["City", readName(cityNameById, form.cityId)],
                ["Main Branch", readName(countryBranchNameById, form.countryBranchId)],
                ["City Branch", readName(cityBranchNameById, form.cityBranchId)],
                ["Category", form.productCategory || "-"],
                ["Brand", form.productBrand || "-"],
                ["Size", form.size || "-"]
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[130px_1fr] gap-2 rounded-md border border-border bg-background px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div>
              <div className="text-sm font-semibold">Product Master Register</div>
              <div className="text-xs text-muted-foreground">Live products saved in the production Product Master.</div>
            </div>
            <div className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search code, SKU, name, HS code..."
              />
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-background">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-3 text-start font-semibold">Product Code</th>
                  <th className="px-3 py-3 text-start font-semibold">Product Name</th>
                  <th className="px-3 py-3 text-start font-semibold">Category</th>
                  <th className="px-3 py-3 text-start font-semibold">Brand</th>
                  <th className="px-3 py-3 text-start font-semibold">Country</th>
                  <th className="px-3 py-3 text-start font-semibold">Main Branch</th>
                  <th className="px-3 py-3 text-start font-semibold">City Branch</th>
                  <th className="px-3 py-3 text-start font-semibold">Size</th>
                  <th className="px-3 py-3 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.length ? (
                  products.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/30">
                      <td className="px-3 py-3 font-semibold text-primary">{product.product_code}</td>
                      <td className="px-3 py-3 font-medium">{product.translated_name || product.product_name}</td>
                      <td className="px-3 py-3">{product.translated_category || "-"}</td>
                      <td className="px-3 py-3">{product.translated_brand || "-"}</td>
                      <td className="px-3 py-3">{readName(countryNameById, product.country_id)}</td>
                      <td className="px-3 py-3">{readName(countryBranchNameById, product.country_branch_id)}</td>
                      <td className="px-3 py-3">{readName(cityBranchNameById, product.city_branch_id)}</td>
                      <td className="px-3 py-3">{product.size || "-"}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          {product.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-3 py-10 text-center text-sm font-medium text-muted-foreground">
                      {loadingProducts ? "Loading product register..." : "No products found."}
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
