"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { listCountries } from "@/features/locations/location-api";
import { listGoods, type GoodsListRow } from "@/features/inventory/goods-api";

type DivideType = "KG" | "Bag" | "Carton" | "Box" | "Ton" | "Custom";
const DIVIDE_TYPES: DivideType[] = ["KG", "Bag", "Carton", "Box", "Ton", "Custom"];

function toNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(toNumber(value));
}

function computeTotals(input: {
  qtyNo: number;
  perQtyWeightKgs: number;
  emptyQtyWeightKgs: number;
  divideValue: number;
  pricePerDivide: number;
  exchangeRate: number;
}) {
  const qtyNo = Math.max(0, toNumber(input.qtyNo));
  const perQty = Math.max(0, toNumber(input.perQtyWeightKgs));
  const emptyPerQty = Math.max(0, toNumber(input.emptyQtyWeightKgs));
  const grossKgs = qtyNo * perQty;
  const totalEmptyKgs = qtyNo * emptyPerQty;
  const netKgs = Math.max(0, grossKgs - totalEmptyKgs);

  const divideValue = Math.max(0, toNumber(input.divideValue));
  const totalDivide = divideValue > 0 ? netKgs / divideValue : 0;
  const price = Math.max(0, toNumber(input.pricePerDivide));
  const exchangeRate = Math.max(0, toNumber(input.exchangeRate) || 1);

  const amount = totalDivide * price;
  const finalAmount = amount * exchangeRate;

  return { grossKgs, totalEmptyKgs, netKgs, totalDivide, amount, finalAmount };
}

export type GoodsEntryValue = {
  countryId: string;
  goodsId: string;
  goodsName: string;
  productCode: string;
  hsCode: string;
  size: string;
  brand: string;
  originCountryId: string;
  imageUrl: string;
  unitType: string;

  qtyNo: number;
  perQtyWeightKgs: number;
  emptyQtyWeightKgs: number;
  divideType: DivideType;
  divideValue: number;
  pricePerDivide: number;
  currencyCode: string;
  exchangeRate: number;
};

export function GoodsEntryCard({
  value,
  onChange,
  goodsManagementHref = "/dashboard/settings/management/goods"
}: {
  value: GoodsEntryValue;
  onChange: (next: GoodsEntryValue) => void;
  goodsManagementHref?: string;
}) {
  const [countries, setCountries] = useState<Array<{ id: string; name: string; currency_code: string }>>([]);
  const [goodsRows, setGoodsRows] = useState<GoodsListRow[]>([]);
  const [loadingGoods, setLoadingGoods] = useState(false);
  const [goodsError, setGoodsError] = useState<string | null>(null);

  useEffect(() => {
    listCountries()
      .then((res) => setCountries(res))
      .catch(() => null);
  }, []);

  async function refreshGoods() {
    if (!value.countryId) return;
    setLoadingGoods(true);
    setGoodsError(null);
    try {
      const res = await listGoods({ limit: 200 });
      setGoodsRows(res.goods ?? []);
    } catch (e: any) {
      setGoodsRows([]);
      setGoodsError(e?.message ?? "Failed to load goods");
    } finally {
      setLoadingGoods(false);
    }
  }

  useEffect(() => {
    void refreshGoods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.countryId]);

  const flatVariations = useMemo(() => {
    const list: Array<{
      id: string; // variation ID
      goodsId: string; // master goods ID
      goodsName: string;
      chsCode: string;
      originCountryId: string | null;
      size: string;
      brand: string;
    }> = [];

    for (const g of goodsRows) {
      const vars = g.variations || [];
      if (vars.length > 0) {
        for (const v of vars) {
          list.push({
            id: v.id,
            goodsId: g.id,
            goodsName: g.goods_name,
            chsCode: g.chs_code,
            originCountryId: v.origin_country_id,
            size: v.size,
            brand: v.brand
          });
        }
      } else {
        list.push({
          id: g.id,
          goodsId: g.id,
          goodsName: g.goods_name,
          chsCode: g.chs_code,
          originCountryId: null,
          size: "",
          brand: ""
        });
      }
    }
    return list;
  }, [goodsRows]);
  // Unique Goods from goodsRows
  const uniqueGoods = useMemo(() => {
    return goodsRows.map(g => ({
      id: g.id,
      goodsName: g.goods_name,
      chsCode: g.chs_code
    }));
  }, [goodsRows]);

  // Selected master goods object
  const selectedMasterGoods = useMemo(() => {
    const foundVar = flatVariations.find(v => v.id === value.goodsId);
    const mId = foundVar ? foundVar.goodsId : value.goodsId;
    return goodsRows.find(g => g.id === mId) ?? null;
  }, [goodsRows, flatVariations, value.goodsId]);

  // Unique Brands filtered by selected Goods
  const filteredBrands = useMemo(() => {
    if (!selectedMasterGoods) return [];
    const vars = selectedMasterGoods.variations || [];
    const brands = vars.map(v => (v.brand || "").trim().toUpperCase()).filter(Boolean);
    return [...new Set(brands)];
  }, [selectedMasterGoods]);

  // Unique Sizes filtered by selected Goods and selected Brand
  const filteredSizes = useMemo(() => {
    if (!selectedMasterGoods) return [];
    const vars = selectedMasterGoods.variations || [];
    const filtered = value.brand
      ? vars.filter(v => (v.brand || "").trim().toLowerCase() === (value.brand || "").trim().toLowerCase())
      : vars;
    const sizes = filtered.map(v => (v.size || "").trim().toUpperCase()).filter(Boolean);
    return [...new Set(sizes)];
  }, [selectedMasterGoods, value.brand]);

  const uniqueGoodsOptions = useMemo(() => {
    return uniqueGoods.map((g) => {
      const parts = [g.goodsName, g.chsCode].filter(Boolean).join(" | ");
      const keywords = [g.goodsName, g.chsCode].filter(Boolean).join(" ");
      return { value: g.id, label: parts || g.goodsName, keywords } satisfies SearchSelectOption;
    });
  }, [uniqueGoods]);

  const handleGoodsChange = (goodsId: string) => {
    const g = goodsRows.find(x => x.id === goodsId);
    if (!g) return;
    onChange({
      ...value,
      goodsId: g.id,
      goodsName: g.goods_name,
      productCode: g.chs_code,
      hsCode: "",
      size: "",
      brand: "",
      originCountryId: "",
      imageUrl: ""
    });
  };

  const handleBrandChange = (brand: string) => {
    if (brand === "__ADD_NEW_BRAND__") {
      const message = `You are adding a new Brand for '${value.goodsName || "selected Good"}'.\n\nDo you want to proceed?`;
      if (confirm(message)) {
        const name = prompt(`Enter custom Brand name for ${value.goodsName || "selected Good"}:`);
        if (name && name.trim()) {
          onChange({
            ...value,
            brand: name.trim().toUpperCase(),
            size: ""
          });
        }
      }
      return;
    }
    onChange({
      ...value,
      brand,
      size: ""
    });
  };

  const handleSizeChange = (size: string) => {
    if (size === "__ADD_NEW_SIZE__") {
      const message = `You are adding a new Size for '${value.goodsName || "selected Good"}' under Brand '${value.brand || "selected Brand"}'.\n\nDo you want to proceed?`;
      if (confirm(message)) {
        const spec = prompt(`Enter custom Size specification for ${value.goodsName || "selected Good"} (${value.brand || "selected Brand"}):`);
        if (spec && spec.trim()) {
          onChange({
            ...value,
            size: spec.trim().toUpperCase()
          });
        }
      }
      return;
    }

    const masterId = selectedMasterGoods?.id || value.goodsId;
    const matchedVar = flatVariations.find(v => 
      v.goodsId === masterId && 
      (v.brand || "").trim().toLowerCase() === (value.brand || "").trim().toLowerCase() && 
      (v.size || "").trim().toLowerCase() === size.trim().toLowerCase()
    );
    onChange({
      ...value,
      goodsId: matchedVar ? matchedVar.id : masterId,
      size,
      originCountryId: matchedVar?.originCountryId ?? value.originCountryId
    });
  };

  const selectedGoods = useMemo(() => flatVariations.find((v) => v.id === value.goodsId) ?? null, [flatVariations, value.goodsId]);
  const originName = useMemo(() => {
    if (selectedGoods?.originCountryId) return countries.find((c) => c.id === selectedGoods.originCountryId)?.name ?? "-";
    if (value.originCountryId) return countries.find((c) => c.id === value.originCountryId)?.name ?? "-";
    return "-";
  }, [countries, selectedGoods?.originCountryId, value.originCountryId]);

  const totals = useMemo(
    () =>
      computeTotals({
        qtyNo: value.qtyNo,
        perQtyWeightKgs: value.perQtyWeightKgs,
        emptyQtyWeightKgs: value.emptyQtyWeightKgs,
        divideValue: value.divideValue,
        pricePerDivide: value.pricePerDivide,
        exchangeRate: value.exchangeRate
      }),
    [value]
  );

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-foreground">Goods Entry</div>
            <div className="text-xs text-muted-foreground">Search goods, preview details, and calculate weights/totals.</div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg"
              onClick={refreshGoods}
              disabled={!value.countryId || loadingGoods}
              aria-label="Refresh goods"
            >
              <RefreshCw className={`h-4 w-4 ${loadingGoods ? "animate-spin" : ""}`} aria-hidden />
            </Button>

            <Button asChild type="button" className="h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
              <a href={goodsManagementHref}>
                <Plus className="h-4 w-4" aria-hidden />
                Add New Goods
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border bg-background p-2">
                <SearchSelect
                  label="Select Goods"
                  value={selectedMasterGoods?.id ?? value.goodsId}
                  options={uniqueGoodsOptions}
                  placeholder={value.countryId ? "Search goods / code" : "Select country first"}
                  disabled={!value.countryId}
                  onValueChange={handleGoodsChange}
                  createLabel="Add New Goods"
                  onCreateNew={() => {
                    window.location.href = goodsManagementHref;
                  }}
                  createButtonPlacement="modal"
                />
              </div>

              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground font-semibold">Select Brand</span>
                <select
                  value={value.brand}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  disabled={!selectedMasterGoods}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
                >
                  <option value="">Select Brand</option>
                  {filteredBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                  <option value="__ADD_NEW_BRAND__" className="text-primary font-semibold">+ Add Custom Brand...</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground font-semibold">Select Size</span>
                <select
                  value={value.size}
                  onChange={(e) => handleSizeChange(e.target.value)}
                  disabled={!value.brand}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
                >
                  <option value="">Select Size</option>
                  {filteredSizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="__ADD_NEW_SIZE__" className="text-primary font-semibold">+ Add Custom Size...</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground font-semibold">Divide Type</span>
                <select
                  value={value.divideType}
                  onChange={(e) => onChange({ ...value, divideType: e.target.value as DivideType })}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  {DIVIDE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Quantity Number</span>
                <input
                  value={String(value.qtyNo)}
                  onChange={(e) => onChange({ ...value, qtyNo: toNumber(e.target.value) })}
                  inputMode="numeric"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Per Quantity Weight (KG)</span>
                <input
                  value={String(value.perQtyWeightKgs)}
                  onChange={(e) => onChange({ ...value, perQtyWeightKgs: toNumber(e.target.value) })}
                  inputMode="decimal"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Empty Quantity Weight (KG)</span>
                <input
                  value={String(value.emptyQtyWeightKgs)}
                  onChange={(e) => onChange({ ...value, emptyQtyWeightKgs: toNumber(e.target.value) })}
                  inputMode="decimal"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Divide Value</span>
                <input
                  value={String(value.divideValue)}
                  onChange={(e) => onChange({ ...value, divideValue: toNumber(e.target.value) })}
                  inputMode="decimal"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Price Per Divide</span>
                <input
                  value={String(value.pricePerDivide)}
                  onChange={(e) => onChange({ ...value, pricePerDivide: toNumber(e.target.value) })}
                  inputMode="decimal"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Exchange Rate</span>
                <input
                  value={String(value.exchangeRate)}
                  onChange={(e) => onChange({ ...value, exchangeRate: toNumber(e.target.value) })}
                  inputMode="decimal"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>
            </div>

            {goodsError ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{goodsError}</div> : null}

            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs font-semibold text-muted-foreground">Auto Totals</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">Total Gross</div>
                  <div className="text-sm font-semibold text-foreground">{formatNumber(totals.grossKgs)}</div>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">Total Empty</div>
                  <div className="text-sm font-semibold text-foreground">{formatNumber(totals.totalEmptyKgs)}</div>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">Net Weight</div>
                  <div className="text-sm font-semibold text-foreground">{formatNumber(totals.netKgs)}</div>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">Total Divide</div>
                  <div className="text-sm font-semibold text-foreground">{formatNumber(totals.totalDivide)}</div>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">Amount</div>
                  <div className="text-sm font-semibold text-foreground">{formatNumber(totals.amount)}</div>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">Final Amount</div>
                  <div className="text-sm font-semibold text-foreground">{formatNumber(totals.finalAmount)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Goods Preview</div>

            <div className="mt-3 flex items-start gap-3">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl border border-border bg-background">
                <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden />
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{value.goodsName || selectedGoods?.goodsName || "-"}</div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Goods Code</div>
                    <div className="font-semibold text-foreground">{value.productCode || "-"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Size</div>
                    <div className="font-semibold text-foreground">{value.size || "-"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Brand</div>
                    <div className="font-semibold text-foreground">{value.brand || "-"}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-muted-foreground">Origin</div>
                    <div className="font-semibold text-foreground">{originName}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
              Goods data is loaded from Settings / Management / Goods Master.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
