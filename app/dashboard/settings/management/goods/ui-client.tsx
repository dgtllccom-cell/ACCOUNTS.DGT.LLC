"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Eye, Pencil, Plus, Printer, QrCode as QrIcon, Save, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiDelete, apiPatch, apiPost } from "@/lib/api/client";
import { listCountries } from "@/features/locations/location-api";
import { listGoods, type GoodsListRow } from "@/features/inventory/goods-api";
import { Th } from "@/components/ui/translated-th";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { Barcode } from "@/components/ui/barcode";
import { QrCode } from "@/components/ui/qr-code";
import { BarcodeScanButton } from "@/components/ui/barcode-scan-button";
import { openBarcodeLabelPrint } from "@/lib/reports/open-barcode-label-print";

type GoodsVariation = {
  id: string;
  goods_id: string;
  size: string;
  brand: string;
  variety?: string | null;
  extra_details?: string | null;
  is_active: boolean;
  created_at: string;
};

type GoodsRecord = {
  id: string;
  chs_code: string;
  goods_name: string;
  origin_country_id: string | null;
  is_active: boolean;
  min_stock_level?: number | null;
  reorder_level?: number | null;
  barcode?: string | null;
  barcode_type?: string | null;
  total_origins: number;
  total_sizes: number;
  total_brands: number;
  variations: GoodsVariation[];
};

type S = ReturnType<typeof useErpScreen>;

const EMPTY_FORM = {
  goodsName: "",
  chsCode: "",
  originCountryId: "",
  minStockLevel: "",
  reorderLevel: "",
  barcode: "",
  barcodeType: "CODE128",
  size: "",
  brand: "",
  variety: "",
  extraDetails: "",
};

function BarcodePreview({ s, value, type }: { s: S; value: string; type: string }) {
  const v = value.trim();
  if (!v) return null;
  return (
    <div className="mt-3 rounded-lg border border-border bg-white p-3" dir="ltr">
      <div className="mb-1 text-xs font-semibold text-muted-foreground">{s.t("barcode_preview", "Barcode Preview")}</div>
      {type === "QR" ? <QrCode value={v} size={120} /> : <Barcode value={v} />}
    </div>
  );
}

export default function GoodsManagementClient({ session }: { session: { preferredLanguage?: string | null } }) {
  const s = useErpScreen("goodsm", session?.preferredLanguage ?? undefined);
  const [countries, setCountries] = useState<Array<{ id: string; name: string; currency_code: string }>>([]);
  const [rows, setRows] = useState<GoodsRecord[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [viewRow, setViewRow] = useState<GoodsRecord | null>(null);
  const [editRow, setEditRow] = useState<GoodsRecord | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [addVarGoods, setAddVarGoods] = useState<GoodsRecord | null>(null);
  const [editVarRow, setEditVarRow] = useState<{ goodsId: string; variation: GoodsVariation } | null>(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    listCountries()
      .then((res) => setCountries(res as any))
      .catch(() => setCountries([]));
  }, []);

  const refresh = useCallback(
    async (opts?: { q?: string }) => {
      setBusy(true);
      try {
        const res = await listGoods({ q: opts?.q ?? "", limit: 100 });
        setRows((res.goods as unknown as GoodsRecord[]) ?? []);
      } catch (e: any) {
        setBanner({ type: "error", text: e?.message ?? s.t("err_load", "Failed to load goods.") });
      } finally {
        setBusy(false);
      }
    },
    [s],
  );

  useEffect(() => {
    const timer = setTimeout(() => void refresh({ q }), 180);
    return () => clearTimeout(timer);
  }, [q]);

  async function createGoods() {
    if (!form.goodsName.trim() || !form.chsCode.trim()) {
      setBanner({ type: "error", text: s.t("err_name_code", "Goods Name and CHS Code are required.") });
      return;
    }
    const hasVariation = form.size.trim() || form.brand.trim() || form.variety.trim() || form.extraDetails.trim() || form.originCountryId;
    if (hasVariation && (!form.size.trim() || !form.brand.trim())) {
      setBanner({ type: "error", text: s.t("err_size_brand", "To add a variation, both Size and Brand are required.") });
      return;
    }
    setBusy(true);
    setBanner(null);
    try {
      await apiPost("/api/erp/goods", {
        chsCode: form.chsCode,
        goodsName: form.goodsName,
        originalLanguage: "en",
        minStockLevel: form.minStockLevel.trim() === "" ? null : Number(form.minStockLevel),
        reorderLevel: form.reorderLevel.trim() === "" ? null : Number(form.reorderLevel),
        barcode: form.barcode.trim() || null,
        barcodeType: form.barcodeType || "CODE128",
        initialVariation: hasVariation
          ? {
              originCountryId: form.originCountryId || null,
              size: form.size.trim(),
              brand: form.brand.trim(),
              variety: form.variety.trim() || null,
              extraDetails: form.extraDetails.trim() || null,
            }
          : null,
      });
      setForm({ ...EMPTY_FORM });
      await refresh({ q });
      setBanner({ type: "success", text: s.t("ok_saved", "Goods Master record and initial variation saved successfully.") });
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? s.t("err_save", "Failed to save goods.") });
    } finally {
      setBusy(false);
    }
  }

  async function saveEditMaster(next: {
    goodsName: string;
    chsCode: string;
    originCountryId: string;
    minStockLevel: string;
    reorderLevel: string;
    barcode: string;
    barcodeType: string;
  }) {
    if (!editRow) return;
    if (!next.goodsName.trim() || !next.chsCode.trim()) {
      setBanner({ type: "error", text: s.t("err_name_code", "Goods Name and CHS Code are required.") });
      return;
    }
    setBusy(true);
    setBanner(null);
    try {
      await apiPatch(`/api/erp/goods/${editRow.id}`, {
        chsCode: next.chsCode,
        goodsName: next.goodsName,
        originalLanguage: "en",
        minStockLevel: next.minStockLevel.trim() === "" ? null : Number(next.minStockLevel),
        reorderLevel: next.reorderLevel.trim() === "" ? null : Number(next.reorderLevel),
        barcode: next.barcode.trim() || null,
        barcodeType: next.barcodeType || "CODE128",
      });
      setEditRow(null);
      await refresh({ q });
      setBanner({ type: "success", text: s.t("ok_updated", "Goods Master record updated successfully.") });
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? s.t("err_update", "Failed to update goods.") });
    } finally {
      setBusy(false);
    }
  }

  async function deleteRow(row: GoodsRecord) {
    const ok = window.confirm(s.t("confirm_delete", "Are you sure you want to delete goods: {name}? This will delete all its variations.").replace("{name}", row.goods_name));
    if (!ok) return;
    setBusy(true);
    setBanner(null);
    try {
      await apiDelete(`/api/erp/goods/${row.id}`);
      await refresh({ q });
      setBanner({ type: "success", text: s.t("ok_deleted", "Goods Master record and variations deleted.") });
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? s.t("err_delete", "Failed to delete goods.") });
    } finally {
      setBusy(false);
    }
  }

  async function handleAddVariation(next: { size: string; brand: string; variety?: string; extraDetails?: string }) {
    if (!addVarGoods) return;
    if (!next.size.trim() || !next.brand.trim()) {
      setBanner({ type: "error", text: s.t("err_size_brand_v", "Size and Brand are required fields.") });
      return;
    }
    setBusy(true);
    try {
      await apiPost("/api/erp/goods/variations", {
        goodsId: addVarGoods.id,
        size: next.size,
        brand: next.brand,
        variety: next.variety,
        extraDetails: next.extraDetails,
      });
      setAddVarGoods(null);
      await refresh({ q });
      setBanner({ type: "success", text: s.t("ok_var_added", "Variation added successfully.") });
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? s.t("err_var_add", "Failed to add variation.") });
    } finally {
      setBusy(false);
    }
  }

  async function handleEditVariation(next: { size: string; brand: string; variety?: string; extraDetails?: string }) {
    if (!editVarRow) return;
    if (!next.size.trim() || !next.brand.trim()) {
      setBanner({ type: "error", text: s.t("err_size_brand_v", "Size and Brand are required fields.") });
      return;
    }
    setBusy(true);
    try {
      await apiPatch(`/api/erp/goods/variations/${editVarRow.variation.id}`, {
        goodsId: editVarRow.goodsId,
        size: next.size,
        brand: next.brand,
        variety: next.variety,
        extraDetails: next.extraDetails,
      });
      setEditVarRow(null);
      await refresh({ q });
      setBanner({ type: "success", text: s.t("ok_var_updated", "Variation updated successfully.") });
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? s.t("err_var_update", "Failed to update variation.") });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteVariation(varId: string) {
    if (!window.confirm(s.t("confirm_delete_var", "Are you sure you want to delete this variation?"))) return;
    setBusy(true);
    try {
      await apiDelete(`/api/erp/goods/variations/${varId}`);
      await refresh({ q });
      setBanner({ type: "success", text: s.t("ok_var_deleted", "Variation deleted successfully.") });
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message ?? s.t("err_var_delete", "Failed to delete variation.") });
    } finally {
      setBusy(false);
    }
  }

  function toggleRow(id: string) {
    const next = new Set(expandedRows);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedRows(next);
  }

  const originNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of countries) map.set(c.id, c.name);
    return map;
  }, [countries]);

  const inp = "h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary";
  const inpSm = "h-8 rounded-md border border-input bg-background px-2.5 text-xs outline-none transition focus:border-primary";

  return (
    <div className="space-y-4" dir={s.dir}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">{s.t("crumb", "Settings / Management")}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{s.t("title", "Goods Master")}</h1>
          <p className="text-sm text-muted-foreground">{s.t("subtitle", "Centralized goods registry used across Purchase, Sales, and Inventory.")}</p>
        </div>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">{s.t("master_data", "Master Data")}</span>
      </div>

      {banner ? (
        <div
          className={`rounded-lg border p-3 text-sm flex justify-between items-center ${
            banner.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-rose-500/30 bg-rose-500/10 text-rose-600"
          }`}
        >
          <span>{banner.text}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setBanner(null)} aria-label={s.t("close", "Close")}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      {/* Creation form */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground font-semibold">{s.t("chs_code", "CHS Code")}</span>
              <input value={form.chsCode} onChange={(e) => setForm((v) => ({ ...v, chsCode: e.target.value }))} className={inp} placeholder={s.t("ph_chs", "e.g. 0802.12.00")} />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground font-semibold">{s.t("goods_name", "Goods Name")}</span>
              <input value={form.goodsName} onChange={(e) => setForm((v) => ({ ...v, goodsName: e.target.value }))} className={inp} placeholder={s.t("ph_name", "e.g. Almonds")} />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground font-semibold">{s.t("origin_country", "Origin Country")}</span>
              <select value={form.originCountryId} onChange={(e) => setForm((v) => ({ ...v, originCountryId: e.target.value }))} className={inp}>
                <option value="">{s.t("select_origin", "Select origin country")}</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Stock control & barcode */}
          <div className="mt-3 border-t pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{s.t("stock_barcode_section", "Stock Control & Barcode")}</span>
            <div className="mt-1.5 grid gap-2.5 md:grid-cols-4">
              <label className="grid gap-1">
                <span className="text-[11px] text-muted-foreground font-semibold">{s.t("min_stock", "Minimum Stock Level")}</span>
                <input type="number" min={0} inputMode="decimal" value={form.minStockLevel} onChange={(e) => setForm((v) => ({ ...v, minStockLevel: e.target.value }))} className={inpSm} placeholder={s.t("optional", "Optional")} />
              </label>
              <label className="grid gap-1">
                <span className="text-[11px] text-muted-foreground font-semibold">{s.t("reorder_level", "Re-order Level")}</span>
                <input type="number" min={0} inputMode="decimal" value={form.reorderLevel} onChange={(e) => setForm((v) => ({ ...v, reorderLevel: e.target.value }))} className={inpSm} placeholder={s.t("optional", "Optional")} />
              </label>
              <label className="grid gap-1">
                <span className="text-[11px] text-muted-foreground font-semibold">{s.t("barcode", "Barcode")}</span>
                <div className="flex items-center gap-1.5">
                  <input value={form.barcode} onChange={(e) => setForm((v) => ({ ...v, barcode: e.target.value }))} className={`${inpSm} flex-1`} placeholder={s.t("optional", "Optional")} />
                  <BarcodeScanButton onScan={(code) => setForm((v) => ({ ...v, barcode: code }))} />
                </div>
              </label>
              <label className="grid gap-1">
                <span className="text-[11px] text-muted-foreground font-semibold">{s.t("barcode_type", "Barcode Type")}</span>
                <select value={form.barcodeType} onChange={(e) => setForm((v) => ({ ...v, barcodeType: e.target.value }))} className={inpSm}>
                  <option value="CODE128">CODE128</option>
                  <option value="EAN13">EAN13</option>
                  <option value="UPC">UPC</option>
                  <option value="QR">QR</option>
                </select>
              </label>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{s.t("stock_hint", "Leave blank to never flag this product as low stock.")}</p>
            <BarcodePreview s={s} value={form.barcode} type={form.barcodeType} />
          </div>

          <div className="mt-3 border-t pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{s.t("initial_variation", "Initial Variation (Optional)")}</span>
            <div className="mt-1.5 grid gap-2.5 md:grid-cols-4">
              <label className="grid gap-1">
                <span className="text-[11px] text-muted-foreground font-semibold">{s.t("size", "Size")}</span>
                <input value={form.size} onChange={(e) => setForm((v) => ({ ...v, size: e.target.value }))} className={inpSm} placeholder={s.t("ph_size", "e.g. 18/20")} />
              </label>
              <label className="grid gap-1">
                <span className="text-[11px] text-muted-foreground font-semibold">{s.t("brand", "Brand")}</span>
                <input value={form.brand} onChange={(e) => setForm((v) => ({ ...v, brand: e.target.value }))} className={inpSm} placeholder={s.t("ph_brand", "e.g. Digital LLC")} />
              </label>
              <label className="grid gap-1">
                <span className="text-[11px] text-muted-foreground font-semibold">{s.t("variety", "Variety")}</span>
                <input value={form.variety} onChange={(e) => setForm((v) => ({ ...v, variety: e.target.value }))} className={inpSm} placeholder={s.t("ph_variety", "e.g. Nonpareil")} />
              </label>
              <label className="grid gap-1">
                <span className="text-[11px] text-muted-foreground font-semibold">{s.t("extra_details", "Extra Details / Specs")}</span>
                <input value={form.extraDetails} onChange={(e) => setForm((v) => ({ ...v, extraDetails: e.target.value }))} className={inpSm} placeholder={s.t("ph_extra", "e.g. Soft Shell")} />
              </label>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
            <div className="text-[11px] text-muted-foreground">{s.t("hint_unique", "Goods records require a unique CHS Code and a Name. Variations are added below.")}</div>
            <Button type="button" className="h-8 rounded-md bg-blue-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700" onClick={createGoods} disabled={busy}>
              {busy ? (
                s.t("saving", "Saving…")
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Save className="h-3.5 w-3.5" />
                  {s.t("save", "Save Goods Master")}
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Registry */}
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div>
              <div className="text-sm font-semibold">{s.t("registry", "Goods Registry")}</div>
              <div className="text-xs text-muted-foreground font-medium">{s.t("registry_hint", "Search products and manage variations.")}</div>
            </div>
            <div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm w-full max-w-xs">
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder={s.t("search_ph", "Search goods name / chs code…")} />
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-background">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <Th className="w-10 px-3 py-3"></Th>
                  <Th className={`px-3 py-3 font-semibold uppercase tracking-wider ${s.textStart}`}>{s.t("chs_code", "CHS Code")}</Th>
                  <Th className={`px-3 py-3 font-semibold uppercase tracking-wider ${s.textStart}`}>{s.t("goods_name", "Goods Name")}</Th>
                  <Th className={`px-3 py-3 font-semibold uppercase tracking-wider ${s.textStart}`}>{s.t("origin_country", "Origin Country")}</Th>
                  <Th className={`px-3 py-3 font-semibold uppercase tracking-wider ${s.textStart}`}>{s.t("barcode", "Barcode")}</Th>
                  <Th className="px-3 py-3 text-center font-semibold uppercase tracking-wider">{s.t("col_total_sizes", "Total Sizes")}</Th>
                  <Th className="px-3 py-3 text-center font-semibold uppercase tracking-wider">{s.t("col_total_brands", "Total Brands")}</Th>
                  <Th className={`px-3 py-3 font-semibold uppercase tracking-wider ${s.textEnd}`}>{s.t("col_actions", "Actions")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length ? (
                  rows.map((r) => {
                    const isExpanded = expandedRows.has(r.id);
                    return (
                      <React.Fragment key={r.id}>
                        <tr className="hover:bg-muted/30 transition">
                          <td className="px-3 py-3 text-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => toggleRow(r.id)} aria-label={isExpanded ? s.t("collapse", "Collapse") : s.t("expand", "Expand")}>
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </td>
                          <td className="px-3 py-3 font-semibold text-foreground">{r.chs_code}</td>
                          <td className="px-3 py-3 text-foreground">{r.goods_name}</td>
                          <td className="px-3 py-3 text-foreground">{r.origin_country_id ? originNameById.get(r.origin_country_id) ?? "-" : s.t("global", "Global")}</td>
                          <td className="px-3 py-3 font-mono text-xs">
                            {r.barcode ? (
                              <span className="inline-flex items-center gap-1">
                                {r.barcode_type === "QR" ? <QrIcon className="h-3 w-3" /> : null}
                                {r.barcode}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-3 py-3 text-center font-medium">{r.total_sizes}</td>
                          <td className="px-3 py-3 text-center font-medium">{r.total_brands}</td>
                          <td className={`px-3 py-3 ${s.textEnd}`}>
                            <div className="flex justify-end gap-1.5">
                              {r.barcode ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    openBarcodeLabelPrint(
                                      [{ code: r.barcode!, name: r.goods_name, reference: r.chs_code, type: (r.barcode_type as any) || "CODE128", copies: 6 }],
                                      { lang: s.lang },
                                    )
                                  }
                                  aria-label={s.tGlobal("prodm.print_label", "Print Label")}
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                              ) : null}
                              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setViewRow(r)} aria-label={s.t("view", "View")}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditRow(r)} aria-label={s.t("edit", "Edit")}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button type="button" variant="outline" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => void deleteRow(r)} disabled={busy} aria-label={s.t("delete", "Delete")}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded ? (
                          <tr className="bg-muted/20">
                            <td colSpan={8} className="px-6 py-4">
                              <div className="rounded-lg border border-border/80 bg-background p-3 shadow-inner">
                                <div className="flex items-center justify-between border-b pb-2 mb-2">
                                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{s.t("variations_list", "Variations List")}</span>
                                  <Button variant="outline" size="sm" onClick={() => setAddVarGoods(r)} className="h-7 rounded-md text-xs font-bold border-dashed flex gap-1 border-primary text-primary hover:bg-primary/5">
                                    <Plus className="h-3.5 w-3.5" />
                                    {s.t("add_variation", "Add Variation")}
                                  </Button>
                                </div>

                                {r.variations && r.variations.length ? (
                                  <table className={`w-full text-xs ${s.textStart}`}>
                                    <thead>
                                      <tr className="text-muted-foreground border-b font-medium">
                                        <Th className={`py-2 ${s.textStart}`}>{s.t("size", "Size")}</Th>
                                        <Th className={`py-2 ${s.textStart}`}>{s.t("brand", "Brand")}</Th>
                                        <Th className={`py-2 ${s.textStart}`}>{s.t("variety", "Variety")}</Th>
                                        <Th className={`py-2 ${s.textStart}`}>{s.t("extra_details", "Extra Details / Specs")}</Th>
                                        <Th className={`py-2 ${s.textEnd}`}>{s.t("col_actions", "Actions")}</Th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                      {r.variations.map((v) => (
                                        <tr key={v.id} className="hover:bg-muted/20">
                                          <td className="py-2 text-muted-foreground font-semibold">{v.size}</td>
                                          <td className="py-2 text-muted-foreground font-semibold">{v.brand}</td>
                                          <td className="py-2 text-muted-foreground">{v.variety || "-"}</td>
                                          <td className="py-2 text-muted-foreground max-w-xs truncate" title={v.extra_details || ""}>
                                            {v.extra_details || "-"}
                                          </td>
                                          <td className={`py-2 ${s.textEnd}`}>
                                            <div className="flex justify-end gap-1">
                                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setEditVarRow({ goodsId: r.id, variation: v })} aria-label={s.t("edit", "Edit")}>
                                                <Pencil className="h-3 w-3" />
                                              </Button>
                                              <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-500 hover:bg-rose-50" onClick={() => void handleDeleteVariation(v.id)} aria-label={s.t("delete", "Delete")}>
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <div className="py-6 text-center text-xs text-muted-foreground font-semibold">{s.t("no_variations", "No variations added yet for this product.")}</div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground font-semibold">
                      {s.t("no_goods", "No goods master records found.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {viewRow ? (
        <SimpleModal title={s.t("details_title", "Goods Details")} onClose={() => setViewRow(null)}>
          <div className="space-y-4" dir={s.dir}>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                [s.t("chs_code", "CHS Code"), viewRow.chs_code],
                [s.t("goods_name", "Goods Name"), viewRow.goods_name],
                [s.t("origin_country", "Origin Country"), viewRow.origin_country_id ? originNameById.get(viewRow.origin_country_id) ?? "-" : s.t("global", "Global")],
                [s.t("barcode", "Barcode"), viewRow.barcode || "-"],
                [s.t("min_stock", "Minimum Stock Level"), viewRow.min_stock_level ?? "-"],
                [s.t("reorder_level", "Re-order Level"), viewRow.reorder_level ?? "-"],
              ].map(([label, val]) => (
                <div key={String(label)} className="rounded-lg border border-border bg-background p-3 shadow-sm">
                  <div className="text-xs text-muted-foreground font-semibold">{label}</div>
                  <div className="mt-1 text-sm font-bold text-foreground">{val}</div>
                </div>
              ))}
            </div>
            {viewRow.barcode ? <BarcodePreview s={s} value={viewRow.barcode} type={viewRow.barcode_type || "CODE128"} /> : null}
            <div className="rounded-lg border border-border bg-background p-3 shadow-sm">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b pb-1.5 mb-2">{s.t("variations_breakdown", "Variations Breakdown")}</div>
              {viewRow.variations && viewRow.variations.length ? (
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {viewRow.variations.map((v) => (
                    <div key={v.id} className="text-xs py-1 px-2 hover:bg-muted/30 rounded flex justify-between border border-border/40">
                      <span className="text-muted-foreground">{v.size}</span>
                      <span className="text-muted-foreground font-medium">{v.brand}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-center py-3 text-muted-foreground font-medium">{s.t("no_variations_loaded", "No variations loaded.")}</div>
              )}
            </div>
          </div>
        </SimpleModal>
      ) : null}

      {editRow ? <EditMasterModal s={s} row={editRow} countries={countries} onClose={() => setEditRow(null)} onSave={saveEditMaster} busy={busy} /> : null}

      {addVarGoods ? (
        <VariationModal s={s} title={s.t("add_variation_for", "Add Variation for {name}").replace("{name}", addVarGoods.goods_name)} onClose={() => setAddVarGoods(null)} onSave={handleAddVariation} busy={busy} />
      ) : null}

      {editVarRow ? (
        <VariationModal
          s={s}
          title={s.t("edit_variation", "Edit Variation")}
          initialValues={{
            size: editVarRow.variation.size,
            brand: editVarRow.variation.brand,
            variety: editVarRow.variation.variety || "",
            extraDetails: editVarRow.variation.extra_details || "",
          }}
          onClose={() => setEditVarRow(null)}
          onSave={handleEditVariation}
          busy={busy}
        />
      ) : null}
    </div>
  );
}

function EditMasterModal({
  s,
  row,
  onClose,
  onSave,
  busy,
  countries,
}: {
  s: S;
  row: GoodsRecord;
  onClose: () => void;
  onSave: (next: { goodsName: string; chsCode: string; originCountryId: string; minStockLevel: string; reorderLevel: string; barcode: string; barcodeType: string }) => void;
  busy: boolean;
  countries: Array<{ id: string; name: string }>;
}) {
  const inp = "h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary";
  const [draft, setDraft] = useState({
    goodsName: row.goods_name ?? "",
    chsCode: row.chs_code ?? "",
    originCountryId: row.origin_country_id ?? "",
    minStockLevel: row.min_stock_level == null ? "" : String(row.min_stock_level),
    reorderLevel: row.reorder_level == null ? "" : String(row.reorder_level),
    barcode: row.barcode ?? "",
    barcodeType: row.barcode_type ?? "CODE128",
  });

  return (
    <SimpleModal title={s.t("edit_master", "Edit Goods Master")} onClose={onClose}>
      <div className="grid gap-3 mb-4" dir={s.dir}>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground font-semibold">{s.t("chs_code", "CHS Code")}</span>
          <input value={draft.chsCode} onChange={(e) => setDraft((d) => ({ ...d, chsCode: e.target.value }))} className={inp} />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground font-semibold">{s.t("goods_name", "Goods Name")}</span>
          <input value={draft.goodsName} onChange={(e) => setDraft((d) => ({ ...d, goodsName: e.target.value }))} className={inp} />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground font-semibold">{s.t("origin_country", "Origin Country")}</span>
          <select value={draft.originCountryId} onChange={(e) => setDraft((d) => ({ ...d, originCountryId: e.target.value }))} className={inp}>
            <option value="">{s.t("select_origin", "Select origin country")}</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground font-semibold">{s.t("min_stock", "Minimum Stock Level")}</span>
            <input type="number" min={0} value={draft.minStockLevel} onChange={(e) => setDraft((d) => ({ ...d, minStockLevel: e.target.value }))} className={inp} placeholder={s.t("optional", "Optional")} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground font-semibold">{s.t("reorder_level", "Re-order Level")}</span>
            <input type="number" min={0} value={draft.reorderLevel} onChange={(e) => setDraft((d) => ({ ...d, reorderLevel: e.target.value }))} className={inp} placeholder={s.t("optional", "Optional")} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground font-semibold">{s.t("barcode", "Barcode")}</span>
            <input value={draft.barcode} onChange={(e) => setDraft((d) => ({ ...d, barcode: e.target.value }))} className={inp} placeholder={s.t("optional", "Optional")} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground font-semibold">{s.t("barcode_type", "Barcode Type")}</span>
            <select value={draft.barcodeType} onChange={(e) => setDraft((d) => ({ ...d, barcodeType: e.target.value }))} className={inp}>
              <option value="CODE128">CODE128</option>
              <option value="EAN13">EAN13</option>
              <option value="UPC">UPC</option>
              <option value="QR">QR</option>
            </select>
          </label>
        </div>
        {draft.barcode.trim() ? <BarcodePreview s={s} value={draft.barcode} type={draft.barcodeType} /> : null}
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={onClose}>
          {s.t("cancel", "Cancel")}
        </Button>
        <Button type="button" className="h-9 rounded-lg font-bold" onClick={() => onSave(draft)} disabled={busy}>
          <Save className="h-4 w-4 mr-1.5" />
          {s.t("save_changes", "Save Changes")}
        </Button>
      </div>
    </SimpleModal>
  );
}

function VariationModal({
  s,
  title,
  initialValues,
  onClose,
  onSave,
  busy,
}: {
  s: S;
  title: string;
  initialValues?: { size: string; brand: string; variety?: string; extraDetails?: string };
  onClose: () => void;
  onSave: (next: { size: string; brand: string; variety?: string; extraDetails?: string }) => void;
  busy: boolean;
}) {
  const inp = "h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary";
  const [draft, setDraft] = useState({
    size: initialValues?.size ?? "",
    brand: initialValues?.brand ?? "",
    variety: initialValues?.variety ?? "",
    extraDetails: initialValues?.extraDetails ?? "",
  });

  return (
    <SimpleModal title={title} onClose={onClose}>
      <div className="grid gap-3 mb-4" dir={s.dir}>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground font-semibold">{s.t("size_spec", "Size Specification")}</span>
            <input value={draft.size} onChange={(e) => setDraft((d) => ({ ...d, size: e.target.value }))} className={inp} placeholder={s.t("ph_size", "e.g. 18/20")} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground font-semibold">{s.t("brand", "Brand")}</span>
            <input value={draft.brand} onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))} className={inp} placeholder={s.t("ph_brand", "e.g. Digital LLC")} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground font-semibold">{s.t("variety", "Variety")}</span>
            <input value={draft.variety} onChange={(e) => setDraft((d) => ({ ...d, variety: e.target.value }))} className={inp} placeholder={s.t("ph_variety", "e.g. Nonpareil")} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground font-semibold">{s.t("quality_details", "Quality / Extra Details")}</span>
            <input value={draft.extraDetails} onChange={(e) => setDraft((d) => ({ ...d, extraDetails: e.target.value }))} className={inp} placeholder={s.t("ph_extra2", "e.g. Soft Shell / Light Color")} />
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={onClose}>
          {s.t("cancel", "Cancel")}
        </Button>
        <Button type="button" className="h-9 rounded-lg font-bold" onClick={() => onSave(draft)} disabled={busy}>
          <Save className="h-4 w-4 mr-1.5" />
          {s.t("save_variation", "Save Variation")}
        </Button>
      </div>
    </SimpleModal>
  );
}
